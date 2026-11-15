-- 1. Why a client was switched off (shown to its people when they try to sign in)
alter table public.orgs add column if not exists off_reason text not null default '';

-- 2. Shipments follow the vehicle's tracker against the marked site coordinates
alter table public.shipments add column if not exists arrived_at timestamptz;

create or replace function public.geo_m(lat1 float8, lng1 float8, lat2 float8, lng2 float8) returns float8
language sql immutable as $$
  select 12742000 * asin(sqrt(least(1, power(sin(radians(lat2 - lat1) / 2), 2) + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2))))
$$;

-- Runs every minute. For each booked or on-the-way shipment with a vehicle that has a tracker:
--  * booked, and the vehicle has been inside the "from" site and is now clearly outside it  -> dispatched automatically
--  * on the way, and the vehicle is inside the "to" site                                     -> arrival recorded (the items are still counted by a person)
-- Sites are matched by name, from the client's own sites and the shared ones.
create or replace function public.shipment_geo_sync() returns integer
language plpgsql security definer set search_path = '' as $$
declare s record; v record; p record; o record; d record; n int := 0;
begin
  for s in select * from public.shipments where status in ('booked', 'in_transit') and coalesce(vehicle_reg, '') <> '' loop
    select tracker_imei into v from public.vehicles where upper(reg) = upper(s.vehicle_reg) and (org_id is null or org_id = s.org_id) and tracker_imei is not null limit 1;
    continue when not found;
    select lat, lng, ts into p from public.tracker_positions where imei = v.tracker_imei and coalesce(fix_valid, true) order by ts desc limit 1;
    continue when not found or p.ts < now() - interval '30 minutes';

    if s.status = 'booked' then
      select * into o from public.sites where lower(name) = lower(s.from_name) and (org_id = s.org_id or org_id is null) order by (org_id is null) limit 1;
      continue when not found;
      if public.geo_m(p.lat, p.lng, o.lat, o.lng) > o.radius_m * 1.5
         and exists (select 1 from public.tracker_positions t where t.imei = v.tracker_imei and t.ts >= s.created_at and public.geo_m(t.lat, t.lng, o.lat, o.lng) <= o.radius_m) then
        update public.shipments set status = 'in_transit', dispatched_at = now() where id = s.id;
        insert into public.shipment_events (shipment_id, org_id, type, detail, by_name) values (s.id, s.org_id, 'dispatched', 'The vehicle left ' || o.name || '. Dispatched automatically from its tracker.', 'GNSS tracker');
        n := n + 1;
      end if;
    elsif s.arrived_at is null then
      select * into d from public.sites where lower(name) = lower(s.to_name) and (org_id = s.org_id or org_id is null) order by (org_id is null) limit 1;
      continue when not found;
      if public.geo_m(p.lat, p.lng, d.lat, d.lng) <= d.radius_m then
        update public.shipments set arrived_at = now() where id = s.id;
        insert into public.shipment_events (shipment_id, org_id, type, detail, by_name) values (s.id, s.org_id, 'update', 'The vehicle arrived at ' || d.name || '. Count what arrived to close the shipment.', 'GNSS tracker');
        n := n + 1;
      end if;
    end if;
  end loop;
  return n;
end $$;

revoke all on function public.shipment_geo_sync() from public, anon, authenticated;
select cron.schedule('shipment-geo-sync', '* * * * *', 'select public.shipment_geo_sync()');
