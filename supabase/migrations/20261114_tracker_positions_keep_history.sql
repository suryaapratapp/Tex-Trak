-- Deleting a tracker must not be blocked by its stored positions (history is kept).
alter table public.tracker_positions drop constraint if exists tracker_positions_imei_fkey;
