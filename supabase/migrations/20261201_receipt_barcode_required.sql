-- To confirm a delivery the customer must give the barcode of any one product on it. The database enforces this, not only the screen.
-- Not needed when nothing on the shipment has a code (older or typed-only shipments), or when no items arrived at all.

create or replace function private.shipment_has_codes(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.shipment_lines l where l.shipment_id = p_id and l.source in ('qr', 'rfid'))
    or exists (select 1 from public.shipment_lines l join public.wh_order_lines o on o.order_id::text = l.ref_id and o.org_id = l.org_id
      join public.wh_items i on i.id = o.item_id where l.shipment_id = p_id and l.source = 'wh_order')
    or exists (select 1 from public.shipment_lines l join public.wh_moves m on m.org_id = l.org_id and m.ref = l.ref_id and m.kind = 'issue'
      join public.wh_items i on i.id = m.item_id where l.shipment_id = p_id and l.source = 'wh_goods_out')
$$;
revoke all on function private.shipment_has_codes(uuid) from public, anon, authenticated;

-- Returns the matched product name (null when no barcode was needed or given), or stops the receipt.
create or replace function private.shipment_receipt_check(p_id uuid, p_code text, p_items integer)
returns text language plpgsql stable security definer set search_path = '' as $$
declare nm text; code text := btrim(coalesce(p_code, ''));
begin
  if length(code) between 1 and 120 then nm := private.shipment_barcode_item(p_id, code); end if;
  if nm is null and p_items > 0 and private.shipment_has_codes(p_id) then
    raise exception '%', case when code = '' then 'Scan the barcode on one of the products in this delivery before you accept it. If you cannot see the scan step, refresh the page.' else 'That barcode does not match a product in this delivery.' end;
  end if;
  return nm;
end $$;
revoke all on function private.shipment_receipt_check(uuid, text, integer) from public, anon, authenticated;

drop function if exists public.shipment_customer_receive(uuid, text, integer, text, text, text, integer);
create or replace function public.shipment_customer_receive(p_id uuid, p_method text, p_items integer, p_name text, p_signature text, p_note text default '', p_scanned integer default null, p_barcode text default null)
returns public.shipments language plpgsql security definer set search_path = '' as $$
declare s public.shipments; who text; nm text := btrim(coalesce(p_name, '')); ev text; next_status text; d text; item text; code text := btrim(coalesce(p_barcode, ''));
begin
  select * into s from public.shipments where id = p_id for update;
  if not found or s.customer_org_id is null or s.customer_org_id is distinct from private.my_org() or not private.can('shipments') then raise exception 'Shipment not found'; end if;
  if s.status in ('delivered', 'cancelled', 'exception') then raise exception 'This shipment is already %.', case s.status when 'delivered' then 'delivered' when 'cancelled' then 'cancelled' else 'closed' end; end if;
  if s.status <> 'in_transit' or s.arrived_at is null then raise exception 'This delivery has not arrived yet. You can accept it once it reaches you.'; end if;
  if p_method not in ('scan', 'confirm') then raise exception 'Choose how you checked the delivery.'; end if;
  if p_items is null or p_items < 0 then raise exception 'Enter how many items arrived.'; end if;
  if length(nm) < 2 then raise exception 'Enter the name of the person receiving.'; end if;
  if p_signature is null or p_signature !~ '^data:image/png;base64,' or length(p_signature) > 400000 or length(p_signature) < 400 then raise exception 'Please sign in the box.'; end if;
  item := private.shipment_receipt_check(p_id, code, p_items);
  select full_name into who from public.profiles where id = auth.uid();
  if p_items = s.items then next_status := 'delivered'; ev := 'received'; d := format('%s of %s items received, %s by %s.', p_items, s.items, case p_method when 'scan' then 'each item scanned' else 'checked and confirmed' end, nm);
  else next_status := 'exception'; ev := 'exception'; d := format('%s of %s items received, %s by %s.', p_items, s.items, case p_method when 'scan' then 'scanned' else 'checked and confirmed' end, nm); end if;
  if item is not null then d := d || format(' Item barcode scanned at receipt: %s (%s).', item, code); end if;
  if btrim(coalesce(p_note, '')) <> '' then d := d || ' ' || btrim(p_note); end if;
  update public.shipments set status = next_status, delivered_at = now(), received_at = now(), items_received = p_items, received_by_name = nm, received_method = p_method,
    received_signature = p_signature, received_scanned = p_scanned, received_barcode = case when item is not null then code end, received_barcode_item = item where id = p_id returning * into s;
  insert into public.shipment_events (shipment_id, org_id, type, detail, by_name, created_by) values (p_id, s.org_id, ev, d, coalesce(who, ''), auth.uid());
  return s;
end $$;
revoke all on function public.shipment_customer_receive(uuid, text, integer, text, text, text, integer, text) from public, anon;
grant execute on function public.shipment_customer_receive(uuid, text, integer, text, text, text, integer, text) to authenticated;

drop function if exists public.public_shipment_accept(text, text, integer, text, text, text, integer);
create or replace function public.public_shipment_accept(p_token text, p_method text, p_items integer, p_name text, p_signature text, p_note text default '', p_scanned integer default null, p_barcode text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.shipments; nm text := btrim(coalesce(p_name, '')); ev text; next_status text; d text; item text; code text := btrim(coalesce(p_barcode, ''));
begin
  select * into s from public.shipments where access_token = p_token and length(coalesce(p_token, '')) >= 32 for update;
  if not found then raise exception 'This link is not valid.'; end if;
  if s.status in ('delivered', 'cancelled', 'exception') then raise exception 'This delivery is already %.', case s.status when 'delivered' then 'confirmed' when 'cancelled' then 'cancelled' else 'closed' end; end if;
  if s.status <> 'in_transit' or s.arrived_at is null then raise exception 'This delivery has not arrived yet. You can confirm it once it reaches you.'; end if;
  if p_method not in ('scan', 'confirm') then raise exception 'Choose how you checked the delivery.'; end if;
  if p_items is null or p_items < 0 or p_items > 1000000 then raise exception 'Enter how many items arrived.'; end if;
  if length(nm) < 2 or length(nm) > 120 then raise exception 'Enter the name of the person receiving.'; end if;
  if p_signature is null or p_signature !~ '^data:image/png;base64,' or length(p_signature) > 400000 or length(p_signature) < 400 then raise exception 'Please sign in the box.'; end if;
  item := private.shipment_receipt_check(s.id, code, p_items);
  if p_items = s.items then next_status := 'delivered'; ev := 'received'; d := format('%s of %s items received, %s by %s (from the emailed link).', p_items, s.items, case p_method when 'scan' then 'each item scanned' else 'checked and confirmed' end, nm);
  else next_status := 'exception'; ev := 'exception'; d := format('%s of %s items received, %s by %s (from the emailed link).', p_items, s.items, case p_method when 'scan' then 'scanned' else 'checked and confirmed' end, nm); end if;
  if item is not null then d := d || format(' Item barcode scanned at receipt: %s (%s).', item, code); end if;
  if btrim(coalesce(p_note, '')) <> '' then d := d || ' ' || left(btrim(p_note), 300); end if;
  update public.shipments set status = next_status, delivered_at = now(), received_at = now(), items_received = p_items, received_by_name = nm, received_method = p_method,
    received_signature = p_signature, received_scanned = p_scanned, received_barcode = case when item is not null then code end, received_barcode_item = item where id = s.id;
  insert into public.shipment_events (shipment_id, org_id, type, detail, by_name) values (s.id, s.org_id, ev, d, nm);
  return jsonb_build_object('status', next_status, 'items_received', p_items);
end $$;
revoke all on function public.public_shipment_accept(text, text, integer, text, text, text, integer, text) from public;
grant execute on function public.public_shipment_accept(text, text, integer, text, text, text, integer, text) to anon, authenticated;
