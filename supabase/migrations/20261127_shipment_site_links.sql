-- A shipment whose From or To is written as an address or another name can be linked to a marked site, so the map still shows both places.
-- The wording on the shipment stays as booked; the linked site only supplies the position.
alter table public.shipments
  add column if not exists from_site_id uuid references public.sites(id) on delete set null,
  add column if not exists to_site_id uuid references public.sites(id) on delete set null;

create or replace function private.shipment_live_json(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare s public.shipments; tk text; v record; t record; last_p record; o record; d record; trail jsonb; manual jsonb; fin boolean; t_from timestamptz; t_to timestamptz;
begin
  select * into s from public.shipments where id = p_id;
  if not found then return null; end if;
  fin := s.status in ('delivered', 'exception');
  select * into o from public.sites where (id = s.from_site_id or lower(name) = lower(s.from_name)) and (org_id = s.org_id or org_id is null) order by (id is not distinct from s.from_site_id) desc, (org_id is null) limit 1;
  select * into d from public.sites where (id = s.to_site_id or lower(name) = lower(s.to_name)) and (org_id = s.org_id or org_id is null) order by (id is not distinct from s.to_site_id) desc, (org_id is null) limit 1;
  tk := nullif(s.tracker_imei, '');
  if tk is null and coalesce(s.vehicle_reg, '') <> '' then select tracker_imei into v from public.vehicles where upper(reg) = upper(s.vehicle_reg) and (org_id is null or org_id = s.org_id) and tracker_imei is not null limit 1; tk := v.tracker_imei; end if;
  if tk is null then return jsonb_build_object('tracked', false, 'status', s.status, 'arrived_at', s.arrived_at, 'reason', 'This delivery is not tracked.'); end if;
  if s.status not in ('in_transit', 'delivered', 'exception') then return jsonb_build_object('tracked', true, 'live', false, 'status', s.status, 'arrived_at', s.arrived_at, 'reason', case when s.status = 'booked' then 'It has not left yet.' else 'This delivery is complete.' end,
    'from', case when o.id is not null then jsonb_build_object('name', s.from_name, 'lat', o.lat, 'lng', o.lng, 'radius', o.radius_m) end, 'to', case when d.id is not null then jsonb_build_object('name', s.to_name, 'lat', d.lat, 'lng', d.lng, 'radius', d.radius_m) end); end if;
  t_from := coalesce(s.dispatched_at, s.created_at);
  t_to := case when fin then coalesce(s.received_at, s.delivered_at, s.arrived_at, now()) else 'infinity'::timestamptz end;
  select name into t from public.trackers where imei = tk;
  select lat, lng, ts, speed_kmh into last_p from public.tracker_positions where imei = tk and coalesce(fix_valid, true) and ts <= t_to order by ts desc limit 1;
  select coalesce(jsonb_agg(jsonb_build_array(lat, lng, ts) order by ts), '[]'::jsonb) into trail from (select lat, lng, ts from public.tracker_positions where imei = tk and coalesce(fix_valid, true) and ts >= t_from and ts <= t_to order by ts desc limit 300) x;
  select coalesce(jsonb_agg(jsonb_build_array(lat, lng, ts, entered_name) order by ts), '[]'::jsonb) into manual from public.shipment_route_points where shipment_id = s.id;
  return jsonb_build_object('tracked', true, 'live', true, 'done', fin, 'status', s.status, 'arrived_at', s.arrived_at, 'name', t.name,
    'last', case when last_p.ts is not null and (not fin or last_p.ts >= t_from) then jsonb_build_object('lat', last_p.lat, 'lng', last_p.lng, 'ts', last_p.ts, 'speed', last_p.speed_kmh) end, 'trail', trail, 'manual', manual,
    'from', case when o.id is not null then jsonb_build_object('name', s.from_name, 'lat', o.lat, 'lng', o.lng, 'radius', o.radius_m) end, 'to', case when d.id is not null then jsonb_build_object('name', s.to_name, 'lat', d.lat, 'lng', d.lng, 'radius', d.radius_m) end);
end $function$;
