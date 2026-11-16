-- A shipment sent "To" a customer's name belongs to that customer's account, even if the Customer account box was left empty (applied live).
create or replace function public.shipment_link_customer() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.customer_org_id is null then
    select o.id into new.customer_org_id from public.orgs o
      where o.kind = 'customer' and o.owner_org = new.org_id and lower(btrim(o.name)) = lower(btrim(new.to_name)) limit 1;
  end if;
  return new;
end $$;
drop trigger if exists shipments_link_customer on public.shipments;
create trigger shipments_link_customer before insert or update of to_name, customer_org_id on public.shipments for each row execute function public.shipment_link_customer();
update public.shipments s set customer_org_id = o.id from public.orgs o
where s.customer_org_id is null and o.kind = 'customer' and o.owner_org = s.org_id and lower(btrim(o.name)) = lower(btrim(s.to_name));
