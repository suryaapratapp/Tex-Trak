-- Applied live. Customers open /track/<token> with no sign-in.
-- * shipments.access_token (secret, unique, default random) and orgs.contact_email
-- * private.shipment_live_json(uuid) + public.shipment_live(uuid) (checked) + public.public_shipment_live(text) (token)
-- * public.public_shipment(text), public.public_shipment_accept(text, text, integer, text, text, text, integer) granted to anon
-- * public.shipment_customers(text) now also returns the contact email; public.customer_set_email(text, text)
-- The edge function shipment-notify emails the link (needs RESEND_API_KEY).
select 1;
