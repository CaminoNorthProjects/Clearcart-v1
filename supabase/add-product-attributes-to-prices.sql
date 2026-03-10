-- Migration: Add product attribute columns to the prices table
-- Required by The Luis Rule (is_perishable, is_bulk_discount) and
-- The Jennifer Rule (health_flags, is_green_certified, is_farm_direct).
--
-- Safe to run multiple times — all statements use IF NOT EXISTS.

ALTER TABLE prices
  ADD COLUMN IF NOT EXISTS is_perishable      boolean   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_bulk_discount   boolean   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS health_flags       text[]    NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_green_certified boolean   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_farm_direct     boolean   NOT NULL DEFAULT false;

-- health_flags accepted values (informational):
--   'artificial_colors'   — product contains artificial colouring agents
--   'high_preservatives'  — product contains high levels of preservatives
--
-- Rows where (is_green_certified OR is_farm_direct) are eligible to be
-- suggested as Jennifer Rule alternatives to flagged items.

COMMENT ON COLUMN prices.is_perishable      IS 'True when the product spoils quickly (dairy, fresh produce, deli). Used by The Luis Rule.';
COMMENT ON COLUMN prices.is_bulk_discount   IS 'True when this price row represents a bulk-quantity discount. Used by The Luis Rule.';
COMMENT ON COLUMN prices.health_flags       IS 'Array of health concern labels, e.g. {artificial_colors, high_preservatives}. Used by The Jennifer Rule.';
COMMENT ON COLUMN prices.is_green_certified IS 'True when the product carries a recognised green/organic certification. Used as a Jennifer Rule alternative.';
COMMENT ON COLUMN prices.is_farm_direct     IS 'True when the product is sourced directly from a farm. Used as a Jennifer Rule alternative.';
