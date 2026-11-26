-- While a shipment is on the way, History records where it was when it first got about 25%, 50% and 75% of the way.
-- * Only positions reported by the tracker count. Manually entered route points never do.
-- * "Of the way" is how much of the straight-line distance from the From site to the To site has been closed.
-- * If the tracker was silent while two or more marks were passed, only the furthest one reached is recorded,
--   because there is no reported position for the earlier ones.
-- * The history line keeps its real recording time; the time of the tracker's report is written in the text.
alter table public.shipments add column if not exists progress_pct smallint not null default 0;

create or replace function public.shipment_progress_sync() returns integer
language plpgsql security definer set search_path = '' as $$
declare s record; o record; d record; p record; tk text; total float8; done int; mark int; n int := 0;
begin
  for s in select * from public.shipments where status = 'in_transit' and dispatched_at is not null and progress_pct < 75 for update skip locked loop
    tk := nullif(s.tracker_imei, '');
    if tk is null and coalesce(s.vehicle_reg, '') <> '' then
      select tracker_imei into tk from public.vehicles where upper(reg) = upper(s.vehicle_reg) and (org_id is null or org_id = s.org_id) and tracker_imei is not null limit 1;
    end if;
    continue when tk is null;
    select * into o from public.sites where (id = s.from_site_id or lower(name) = lower(s.from_name)) and (org_id = s.org_id or org_id is null) order by (id is not distinct from s.from_site_id) desc, (org_id is null) limit 1;
    continue when not found;
    select * into d from public.sites where (id = s.to_site_id or lower(name) = lower(s.to_name)) and (org_id = s.org_id or org_id is null) order by (id is not distinct from s.to_site_id) desc, (org_id is null) limit 1;
    continue when not found;
    total := public.geo_m(o.lat, o.lng, d.lat, d.lng);
    continue when total < greatest(1000, o.radius_m + d.radius_m); -- too short a trip for marks to mean anything
    done := s.progress_pct;
    while done < 75 loop
      select t.lat, t.lng, t.ts, public.geo_m(t.lat, t.lng, d.lat, d.lng) as left_m into p
        from public.tracker_positions t
       where t.imei = tk and coalesce(t.fix_valid, true) and t.ts >= s.dispatched_at and t.ts <= least(coalesce(s.arrived_at, 'infinity'::timestamptz), now() + interval '5 minutes')
         and 1 - public.geo_m(t.lat, t.lng, d.lat, d.lng) / total >= (done + 25) / 100.0
       order by t.ts limit 1;
      exit when not found;
      mark := least(75, floor((1 - p.left_m / total) * 4)::int * 25);
      insert into public.shipment_events (shipment_id, org_id, type, detail, by_name) values (s.id, s.org_id, 'update',
        format('About %s%% of the way. It was at %s, %s at %s (UK time), %s km from %s in a straight line.', mark,
          round(p.lat::numeric, 5), round(p.lng::numeric, 5), to_char(p.ts at time zone 'Europe/London', 'DD Mon HH24:MI'),
          case when p.left_m < 10000 then round((p.left_m / 1000)::numeric, 1) else round((p.left_m / 1000)::numeric) end, s.to_name), 'GNSS tracker');
      done := mark; n := n + 1;
    end loop;
    if done <> s.progress_pct then update public.shipments set progress_pct = done where id = s.id; end if;
  end loop;
  return n;
end $$;

revoke all on function public.shipment_progress_sync() from public, anon, authenticated;
-- Same one-minute job as before. Progress runs first so its lines sit before an arrival recorded in the same minute.
select cron.schedule('shipment-geo-sync', '* * * * *', 'select public.shipment_progress_sync(); select public.shipment_geo_sync()');
