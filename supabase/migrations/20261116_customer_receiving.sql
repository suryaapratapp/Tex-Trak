-- Customer accounts that receive shipments: confirm by scanning or by declaration, with name and signature.

alter table public.orgs
  add column if not exists kind text not null default 'client' check (kind in ('client', 'customer')),
  add column if not exists owner_org text references public.orgs(id) on delete set null;

alter table public.shipments
  add column if not exists customer_org_id text references public.orgs(id) on delete set null,
  add column if not exists received_by_name text,
  add column if not exists received_method text check (received_method in ('scan', 'confirm')),
  add column if not exists received_signature text,
  add column if not exists received_at timestamptz,
  add column if not exists received_scanned integer;
create index if not exists shipments_customer_idx on public.shipments (customer_org_id);

create or replace function private.is_my_customer_shipment(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.shipments s where s.id = p_id and s.customer_org_id is not null and s.customer_org_id = private.my_org())
$$;

drop policy if exists shipments_read on public.shipments;
create policy shipments_read on public.shipments for select using (
  (select private.can('shipments')) and ((select private.my_role()) = 'superadmin' or org_id = (select private.my_org()) or customer_org_id = (select private.my_org())));
drop policy if exists shipment_lines_read on public.shipment_lines;
create policy shipment_lines_read on public.shipment_lines for select using (
  (select private.can('shipments')) and ((select private.my_role()) = 'superadmin' or org_id = (select private.my_org()) or private.is_my_customer_shipment(shipment_id)));
drop policy if exists shipment_events_read on public.shipment_events;
create policy shipment_events_read on public.shipment_events for select using (
  (select private.can('shipments')) and ((select private.my_role()) = 'superadmin' or org_id = (select private.my_org()) or private.is_my_customer_shipment(shipment_id)));

-- Which customer accounts may this sender book shipments to?
create or replace function public.shipment_customers(p_org text) returns table (id text, name text)
language sql stable security definer set search_path = '' as $$
  select o.id, o.name from public.orgs o
  where o.kind = 'customer' and o.active and o.owner_org = p_org
    and ((select private.my_role()) = 'superadmin' or p_org = (select private.my_org()))
  order by o.name
$$;

create or replace function private.customer_ok(p_org text, p_customer text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.orgs o where o.id = p_customer and o.kind = 'customer' and o.owner_org = p_org)
$$;

drop function if exists public.shipment_book(text, text, text, text, text, text, text, integer, numeric, timestamptz, timestamptz, jsonb);
create or replace function public.shipment_book(p_org text, p_kind text, p_from text, p_to text, p_carrier text, p_vehicle text, p_desc text, p_items integer, p_weight numeric, p_planned_dispatch timestamptz, p_planned_arrival timestamptz, p_lines jsonb default null, p_customer text default null)
returns public.shipments language plpgsql set search_path = '' as $$
declare s public.shipments; who text; l jsonb; n int := 0; tot numeric := 0; clash text; cnt int; cust text := nullif(btrim(coalesce(p_customer, '')), '');
begin
  select full_name into who from public.profiles where id = auth.uid();
  if cust is not null and not private.customer_ok(p_org, cust) then raise exception 'That customer account is not set up for this client.'; end if;
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
  insert into public.shipments (org_id, kind, from_name, to_name, carrier, vehicle_reg, description, items, weight_kg, planned_dispatch, planned_arrival, created_by, customer_org_id)
  values (p_org, p_kind, p_from, p_to, coalesce(p_carrier,''), coalesce(p_vehicle,''), coalesce(p_desc,''), case when n > 0 then greatest(1, round(tot)::int) else p_items end, p_weight, p_planned_dispatch, p_planned_arrival, auth.uid(), cust) returning * into s;
  if n > 0 then
    insert into public.shipment_lines (shipment_id, org_id, source, ref_id, label, qty)
      select s.id, s.org_id, x->>'source', x->>'ref', coalesce(x->>'label', ''), coalesce((x->>'qty')::numeric, 1) from jsonb_array_elements(p_lines) x;
  end if;
  insert into public.shipment_events (shipment_id, org_id, type, detail, by_name, created_by) values (s.id, s.org_id, 'booked', format('%s to %s', p_from, p_to), coalesce(who,''), auth.uid());
  return s;
end $$;

-- The customer accepts a delivery: by scanning (p_method 'scan') or by declaring they checked it (p_method 'confirm'), with name and signature.
create or replace function public.shipment_customer_receive(p_id uuid, p_method text, p_items integer, p_name text, p_signature text, p_note text default '', p_scanned integer default null)
returns public.shipments language plpgsql security definer set search_path = '' as $$
declare s public.shipments; who text; nm text := btrim(coalesce(p_name, '')); ev text; next_status text; d text;
begin
  select * into s from public.shipments where id = p_id for update;
  if not found or s.customer_org_id is null or s.customer_org_id is distinct from private.my_org() or not private.can('shipments') then raise exception 'Shipment not found'; end if;
  if s.status not in ('booked', 'in_transit') then raise exception 'This shipment is already %.', case s.status when 'delivered' then 'delivered' when 'cancelled' then 'cancelled' else 'closed' end; end if;
  if p_method not in ('scan', 'confirm') then raise exception 'Choose how you checked the delivery.'; end if;
  if p_items is null or p_items < 0 then raise exception 'Enter how many items arrived.'; end if;
  if length(nm) < 2 then raise exception 'Enter the name of the person receiving.'; end if;
  if p_signature is null or p_signature !~ '^data:image/png;base64,' or length(p_signature) > 400000 or length(p_signature) < 400 then raise exception 'Please sign in the box.'; end if;
  select full_name into who from public.profiles where id = auth.uid();
  if p_items = s.items then next_status := 'delivered'; ev := 'received'; d := format('%s of %s items received, %s by %s.', p_items, s.items, case p_method when 'scan' then 'each item scanned' else 'checked and confirmed' end, nm);
  else next_status := 'exception'; ev := 'exception'; d := format('%s of %s items received, %s by %s.', p_items, s.items, case p_method when 'scan' then 'scanned' else 'checked and confirmed' end, nm); end if;
  if btrim(coalesce(p_note, '')) <> '' then d := d || ' ' || btrim(p_note); end if;
  update public.shipments set status = next_status, delivered_at = now(), received_at = now(), items_received = p_items, received_by_name = nm, received_method = p_method,
    received_signature = p_signature, received_scanned = p_scanned, dispatched_at = coalesce(dispatched_at, now()) where id = p_id returning * into s;
  insert into public.shipment_events (shipment_id, org_id, type, detail, by_name, created_by) values (p_id, s.org_id, ev, d, coalesce(who, ''), auth.uid());
  return s;
end $$;

revoke all on function public.shipment_customers(text), public.shipment_customer_receive(uuid, text, integer, text, text, text, integer) from public, anon;
grant execute on function public.shipment_customers(text), public.shipment_customer_receive(uuid, text, integer, text, text, text, integer) to authenticated;
revoke all on function public.shipment_book(text, text, text, text, text, text, text, integer, numeric, timestamptz, timestamptz, jsonb, text) from public, anon;
grant execute on function public.shipment_book(text, text, text, text, text, text, text, integer, numeric, timestamptz, timestamptz, jsonb, text) to authenticated;
