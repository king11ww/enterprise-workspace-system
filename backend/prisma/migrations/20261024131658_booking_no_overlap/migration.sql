-- Database-level guarantee against double-booking.
-- The Redis lock in BookingsService is the primary guard; this exclusion
-- constraint is the last line of defence (e.g. if a lock TTL expires mid-request).
-- Two non-cancelled bookings for the same resource may not have overlapping
-- [start_time, end_time) ranges.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist (
    "resource_id" WITH =,
    tsrange("start_time", "end_time", '[)') WITH &&
  )
  WHERE ("status" <> 'CANCELLED');