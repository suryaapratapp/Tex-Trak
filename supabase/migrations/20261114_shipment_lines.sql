-- What is in a shipment: lines picked from Warehouse (packed orders, goods out), curtains (QR) or laundry items (RFID).
create table if not exists public.shipment_lines (
  id bigserial primary key,
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  org_id text not null,
  source text not null check (source in ('wh_order', 'wh_goods_out', 'qr', 'rfid', 'typed')),
  ref_id text not null,
  label text not null default '',
  qty numeric not null default 1 check (qty > 0),
  created_at timestamptz not null default now()
);
create index if not exists shipment_lines_ship on public.shipment_lines (shipment_id);
create index if not exists shipment_lines_ref on public.shipment_lines (org_id, source, ref_id);
alter table public.shipment_lines enable row level security;
drop policy if exists shipment_lines_read on public.shipment_lines;
create policy shipment_lines_read on public.shipment_lines for select using (
  (select private.can('shipments')) and ((select private.my_role()) = 'superadmin' or org_id = (select private.my_org())));
drop policy if exists shipment_lines_insert on public.shipment_lines;
create policy shipment_lines_insert on public.shipment_lines for insert with check (
  (select private.can('shipments')) and ((select private.my_role()) = 'superadmin' or org_id = (select private.my_org())));

drop function if exists public.shipment_book(text, text, text, text, text, text, text, integer, numeric, timestamptz, timestamptz);
create or replace function public.shipment_book(p_org text, p_kind text, p_from text, p_to text, p_carrier text, p_vehicle text, p_desc text, p_items integer, p_weight numeric, p_planned_dispatch timestamptz, p_planned_arrival timestamptz, p_lines jsonb default null)
returns public.shipments language plpgsql set search_path to '' as $$
declare s public.shipments; who text; l jsonb; n int := 0; tot numeric := 0; clash text; cnt int;
begin
  select full_name into who from public.profiles where id = auth.uid();
  if p_lines is not null and jsonb_typeof(p_lines) = 'array' then
    cnt := jsonb_array_length(p_lines);
    if cnt > 2000 then raise exception 'Up to 2000 lines per shipment.'; end if;
    for l in select * from jsonb_array_elements(p_lines) loop
      if (l->>'source') not in ('wh_order', 'wh_goods_out', 'qr', 'rfid', 'typed') then raise exception 'Unknown source.'; end if;
      if (l->>'source') <> 'typed' then
        select sh.ref into clash from public.shipment_lines sl join public.shipments sh on sh.id = sl.shipment_id
          where sl.org_id = p_org and sl.source = l->>'source' and sl.ref_id = l->>'ref' and sh.status <> 'cancelled' limit 1;
        if clash is not null then raise exception '% is already on shipment %.', coalesce(l->>'label', l->>'ref'), clash; end if;
      end if;
      tot := tot + coalesce((l->>'qty')::numeric, 1); n := n + 1;
    end loop;
  end if;
  insert into public.shipments (org_id, kind, from_name, to_name, carrier, vehicle_reg, description, items, weight_kg, planned_dispatch, planned_arrival, created_by)
  values (p_org, p_kind, p_from, p_to, coalesce(p_carrier,''), coalesce(p_vehicle,''), coalesce(p_desc,''), case when n > 0 then greatest(1, round(tot)::int) else p_items end, p_weight, p_planned_dispatch, p_planned_arrival, auth.uid()) returning * into s;
  if n > 0 then
    insert into public.shipment_lines (shipment_id, org_id, source, ref_id, label, qty)
      select s.id, s.org_id, x->>'source', x->>'ref', coalesce(x->>'label', ''), coalesce((x->>'qty')::numeric, 1) from jsonb_array_elements(p_lines) x;
  end if;
  insert into public.shipment_events (shipment_id, org_id, type, detail, by_name, created_by) values (s.id, s.org_id, 'booked', format('%s to %s', p_from, p_to), coalesce(who,''), auth.uid());
  return s;
end $$;
