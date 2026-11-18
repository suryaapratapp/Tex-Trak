-- How often each device really reports (median gap between its last records), so "online" is judged against its own rhythm (applied live).
create or replace function public.device_rhythm() returns table (imei text, interval_min numeric)
language sql stable security invoker set search_path = '' as $$
  with r as (select p.imei, p.ts, row_number() over (partition by p.imei order by p.ts desc) rn from public.tracker_positions p where p.ts > now() - interval '3 days'),
  g as (select r.imei, extract(epoch from (r.ts - lag(r.ts) over (partition by r.imei order by r.ts))) / 60 gap from r where r.rn <= 12)
  select g.imei, round((percentile_cont(0.5) within group (order by g.gap))::numeric, 1) from g where g.gap is not null group by g.imei
$$;
revoke all on function public.device_rhythm() from public, anon;
grant execute on function public.device_rhythm() to authenticated;
