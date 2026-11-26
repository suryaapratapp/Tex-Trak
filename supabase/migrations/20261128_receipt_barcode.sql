-- Optional proof at receipt: the customer scans the barcode of one item. It is checked against what is on the shipment and, if it matches, kept with the receipt.
alter table public.shipments
  add column if not exists received_barcode text,
  add column if not exists received_barcode_item text;

-- The name of the item on this shipment that carries this code, or null if nothing on it does.
create or replace function private.shipment_barcode_item(p_id uuid, p_code text)
returns text language sql stable security definer set search_path = '' as $$
  with c as (select upper(btrim(coalesce(p_code, ''))) code),
  its as (
    select o.item_id from public.shipment_lines l join public.wh_order_lines o on o.order_id::text = l.ref_id and o.org_id = l.org_id
      where l.shipment_id = p_id and l.source = 'wh_order'
    union
    select m.item_id from public.shipment_lines l join public.wh_moves m on m.org_id = l.org_id and m.ref = l.ref_id and m.kind = 'issue'
      where l.shipment_id = p_id and l.source = 'wh_goods_out'
  )
  select x.name from (
    select i.name from its join public.wh_items i on i.id = its.item_id, c
      where c.code <> '' and (upper(btrim(coalesce(i.barcode, ''))) = c.code or upper(i.sku) = c.code
        or exists (select 1 from public.wh_codes w where w.item_id = i.id and w.org_id = i.org_id and upper(w.code) = c.code))
    union all
    select l.label from public.shipment_lines l, c where l.shipment_id = p_id and l.source in ('qr', 'rfid') and upper(btrim(l.label)) = c.code
  ) x limit 1
$$;
revoke all on function private.shipment_barcode_item(uuid, text) from public, anon, authenticated;

-- Checks a code, and with p_record saves it. Saving is only possible once, within an hour of signing.
create or replace function private.shipment_barcode_apply(p_id uuid, p_code text, p_record boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare s public.shipments; nm text; code text := btrim(coalesce(p_code, ''));
begin
  if length(code) < 1 or length(code) > 120 then return null; end if;
  nm := private.shipment_barcode_item(p_id, code);
  if nm is null or not coalesce(p_record, false) then return nm; end if;
  update public.shipments set received_barcode = code, received_barcode_item = nm
    where id = p_id and received_barcode is null and received_at > now() - interval '1 hour' returning * into s;
  if found then
    insert into public.shipment_events (shipment_id, org_id, type, detail, by_name)
      values (p_id, s.org_id, 'update', format('Item barcode scanned at receipt: %s (%s).', nm, code), coalesce(s.received_by_name, ''));
  end if;
  return nm;
end $$;
revoke all on function private.shipment_barcode_apply(uuid, text, boolean) from public, anon, authenticated;

-- Signed-in customer account.
create or replace function public.shipment_receipt_barcode(p_id uuid, p_code text, p_record boolean default false)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.shipments s where s.id = p_id and s.customer_org_id is not null and s.customer_org_id = private.my_org()) or not private.can('shipments') then raise exception 'Shipment not found'; end if;
  return private.shipment_barcode_apply(p_id, p_code, p_record);
end $$;
revoke all on function public.shipment_receipt_barcode(uuid, text, boolean) from public, anon;
grant execute on function public.shipment_receipt_barcode(uuid, text, boolean) to authenticated;

-- The emailed customer link: the secret token is the key.
create or replace function public.public_shipment_barcode(p_token text, p_code text, p_record boolean default false)
returns text language plpgsql security definer set search_path = '' as $$
declare sid uuid;
begin
  select id into sid from public.shipments where access_token = p_token and length(coalesce(p_token, '')) >= 32;
  if sid is null then raise exception 'Shipment not found'; end if;
  return private.shipment_barcode_apply(sid, p_code, p_record);
end $$;
revoke all on function public.public_shipment_barcode(text, text, boolean) from public;
grant execute on function public.public_shipment_barcode(text, text, boolean) to anon, authenticated;
