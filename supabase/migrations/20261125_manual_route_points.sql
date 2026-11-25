-- Route points entered by a person when the tracker did not report. They are kept apart from tracker data
-- (tracker_positions is never touched) and are always shown on the map and in History as "entered manually".
create table if not exists public.shipment_route_points (
  id bigserial primary key,
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  org_id text not null,
  ts timestamptz not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  note text not null default '',
  entered_name text not null default '',
  entered_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists shipment_route_points_ship on public.shipment_route_points (shipment_id, ts);
alter table public.shipment_route_points enable row level security;
drop policy if exists route_points_read on public.shipment_route_points;
create policy route_points_read on public.shipment_route_points for select to authenticated
  using (exists (select 1 from public.shipments s where s.id = shipment_id));

-- Adding a point: super admins and the sender's admins only.
create or replace function public.shipment_add_route_point(p_id uuid, p_ts timestamptz, p_lat double precision, p_lng double precision, p_note text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare s public.shipments; me public.profiles; nm text;
begin
  select * into me from public.profiles where id = auth.uid() and active;
  if not found or me.role not in ('superadmin', 'org_admin') then raise exception 'Only an administrator can add route points.'; end if;
  select * into s from public.shipments where id = p_id;
  if not found or (me.role <> 'superadmin' and me.org_id <> s.org_id) then raise exception 'Shipment not found.'; end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'Those coordinates are not valid.'; end if;
  if p_ts > now() + interval '5 minutes' then raise exception 'A route point cannot be in the future.'; end if;
  nm := coalesce(nullif(me.full_name, ''), me.username);
  insert into public.shipment_route_points (shipment_id, org_id, ts, lat, lng, note, entered_name, entered_by) values (p_id, s.org_id, p_ts, p_lat, p_lng, coalesce(p_note, ''), nm, auth.uid());
  insert into public.shipment_events (shipment_id, org_id, type, detail, by_name, created_by)
    values (p_id, s.org_id, 'update', format('Route point added manually: %s, %s at %s (UK time). Entered by %s. Not reported by the tracker.', round(p_lat::numeric, 6), round(p_lng::numeric, 6), to_char(p_ts at time zone 'Europe/London', 'DD Mon HH24:MI'), nm), nm, auth.uid());
end $$;
revoke all on function public.shipment_add_route_point(uuid, timestamptz, double precision, double precision, text) from public, anon;
grant execute on function public.shipment_add_route_point(uuid, timestamptz, double precision, double precision, text) to authenticated;

-- The live map payload now also carries the manually entered points, separately from the tracker trail.
create or replace function private.shipment_live_json(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare s public.shipments; tk text; v record; t record; last_p record; o record; d record; trail jsonb; manual jsonb;
begin
  select * into s from public.shipments where id = p_id;
  if not found then return null; end if;
  select * into o from public.sites where lower(name) = lower(s.from_name) and (org_id = s.org_id or org_id is null) order by (org_id is null) limit 1;
  select * into d from public.sites where lower(name) = lower(s.to_name) and (org_id = s.org_id or org_id is null) order by (org_id is null) limit 1;
  tk := nullif(s.tracker_imei, '');
  if tk is null and coalesce(s.vehicle_reg, '') <> '' then select tracker_imei into v from public.vehicles where upper(reg) = upper(s.vehicle_reg) and (org_id is null or org_id = s.org_id) and tracker_imei is not null limit 1; tk := v.tracker_imei; end if;
  if tk is null then return jsonb_build_object('tracked', false, 'status', s.status, 'arrived_at', s.arrived_at, 'reason', 'This delivery is not tracked.'); end if;
  if s.status <> 'in_transit' then return jsonb_build_object('tracked', true, 'live', false, 'status', s.status, 'arrived_at', s.arrived_at, 'reason', case when s.status = 'booked' then 'It has not left yet.' else 'This delivery is complete.' end,
    'from', case when o.id is not null then jsonb_build_object('name', o.name, 'lat', o.lat, 'lng', o.lng, 'radius', o.radius_m) end, 'to', case when d.id is not null then jsonb_build_object('name', d.name, 'lat', d.lat, 'lng', d.lng, 'radius', d.radius_m) end); end if;
  select name into t from public.trackers where imei = tk;
  select lat, lng, ts, speed_kmh into last_p from public.tracker_positions where imei = tk and coalesce(fix_valid, true) order by ts desc limit 1;
  select coalesce(jsonb_agg(jsonb_build_array(lat, lng, ts) order by ts), '[]'::jsonb) into trail from (select lat, lng, ts from public.tracker_positions where imei = tk and coalesce(fix_valid, true) and ts >= coalesce(s.dispatched_at, s.created_at) order by ts desc limit 300) x;
  select coalesce(jsonb_agg(jsonb_build_array(lat, lng, ts, entered_name) order by ts), '[]'::jsonb) into manual from public.shipment_route_points where shipment_id = s.id;
  return jsonb_build_object('tracked', true, 'live', true, 'status', s.status, 'arrived_at', s.arrived_at, 'name', t.name,
    'last', case when last_p.ts is not null then jsonb_build_object('lat', last_p.lat, 'lng', last_p.lng, 'ts', last_p.ts, 'speed', last_p.speed_kmh) end, 'trail', trail, 'manual', manual,
    'from', case when o.id is not null then jsonb_build_object('name', o.name, 'lat', o.lat, 'lng', o.lng, 'radius', o.radius_m) end, 'to', case when d.id is not null then jsonb_build_object('name', d.name, 'lat', d.lat, 'lng', d.lng, 'radius', d.radius_m) end);
end $function$;
