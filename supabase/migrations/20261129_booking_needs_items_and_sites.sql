-- Booking rules, enforced for every caller: a shipment needs at least one item, and From and To must be two different marked sites.
-- The chosen sites are stored on the shipment, so the map keeps drawing them even if a site is later renamed.
create or replace function public.shipment_book(p_org text, p_kind text, p_from text, p_to text, p_carrier text, p_vehicle text, p_desc text, p_items integer, p_weight numeric, p_planned_dispatch timestamp with time zone, p_planned_arrival timestamp with time zone, p_lines jsonb DEFAULT NULL::jsonb, p_customer text DEFAULT NULL::text)
 RETURNS public.shipments
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare s public.shipments; who text; l jsonb; n int := 0; tot numeric := 0; clash text; cnt int; cust text := nullif(btrim(coalesce(p_customer, '')), ''); sf record; st record;
begin
  select full_name into who from public.profiles where id = auth.uid();
  if cust is not null and not private.customer_ok(p_org, cust) then raise exception 'That customer account is not set up for this client.'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'Add at least one item to the shipment.'; end if;
  select id, name into sf from public.sites where lower(btrim(name)) = lower(btrim(coalesce(p_from, ''))) and source = 'admin' and (org_id = p_org or org_id is null) order by (org_id is null) limit 1;
  if sf.id is null then raise exception 'Choose the From site from the list.'; end if;
  select id, name into st from public.sites where lower(btrim(name)) = lower(btrim(coalesce(p_to, ''))) and source = 'admin' and (org_id = p_org or org_id is null) order by (org_id is null) limit 1;
  if st.id is null then raise exception 'Choose the To site from the list.'; end if;
  if sf.id = st.id then raise exception 'From and To must be two different sites.'; end if;
  cnt := jsonb_array_length(p_lines);
  if cnt > 2000 then raise exception 'Up to 2000 lines per shipment.'; end if;
  for l in select * from jsonb_array_elements(p_lines) loop
    if coalesce(l->>'source', '') not in ('wh_order', 'wh_goods_out', 'qr', 'rfid') then raise exception 'Unknown source.'; end if;
    if coalesce(l->>'ref', '') = '' or coalesce((l->>'qty')::numeric, 1) <= 0 then raise exception 'Each item needs a reference and a quantity.'; end if;
    select sh.ref into clash from public.shipment_lines sl join public.shipments sh on sh.id = sl.shipment_id
      where sl.org_id = p_org and sl.source = l->>'source' and sl.ref_id = l->>'ref' and sh.status <> 'cancelled' limit 1;
    if clash is not null then raise exception '% is already on shipment %.', coalesce(l->>'label', l->>'ref'), clash; end if;
    tot := tot + coalesce((l->>'qty')::numeric, 1); n := n + 1;
  end loop;
  insert into public.shipments (org_id, kind, from_name, to_name, from_site_id, to_site_id, carrier, vehicle_reg, description, items, weight_kg, planned_dispatch, planned_arrival, created_by, customer_org_id)
  values (p_org, p_kind, sf.name, st.name, sf.id, st.id, coalesce(p_carrier,''), coalesce(p_vehicle,''), coalesce(p_desc,''), greatest(1, round(tot)::int), p_weight, p_planned_dispatch, p_planned_arrival, auth.uid(), cust) returning * into s;
  insert into public.shipment_lines (shipment_id, org_id, source, ref_id, label, qty)
    select s.id, s.org_id, x->>'source', x->>'ref', coalesce(x->>'label', ''), coalesce((x->>'qty')::numeric, 1) from jsonb_array_elements(p_lines) x;
  insert into public.shipment_events (shipment_id, org_id, type, detail, by_name, created_by) values (s.id, s.org_id, 'booked', format('%s to %s', sf.name, st.name), coalesce(who,''), auth.uid());
  return s;
end $function$;
