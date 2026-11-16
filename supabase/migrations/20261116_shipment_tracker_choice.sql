-- A shipment can be followed by a tracker or phone directly, not only through a vehicle registration.
alter table public.shipments add column if not exists tracker_imei text;
-- public.shipment_geo_sync() now uses shipments.tracker_imei first, then the tracker fitted to the vehicle (applied live).
