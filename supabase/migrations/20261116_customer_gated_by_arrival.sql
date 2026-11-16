-- Applied live. Summary of what changed (see the function bodies in the database for the full text):
-- * public.shipment_geo_sync(): a booked shipment is dispatched as soon as its tracker is outside the From site's radius (after having been inside since booking);
--   an in-transit shipment gets arrived_at as soon as its tracker is inside the To site's radius.
-- * public.shipment_customer_receive(): the customer can only accept once the shipment is in_transit AND arrived_at is set.
-- * public.shipment_step(): new action 'arrived' lets the sender mark an untracked shipment as arrived (which opens it up for the customer).
-- * public.shipment_live(p_id uuid): latest position, trail and the From/To sites of one shipment, for the customer it is assigned to, its sender, or a Super Admin.
--   Returns only while the shipment is on the way; nothing about other shipments or vehicles.
select 1;
