-- Phase 4: Link prices to receipt scans
-- Run this in Supabase SQL Editor before implementing normalization

ALTER TABLE prices ADD COLUMN IF NOT EXISTS receipt_scan_id UUID REFERENCES receipt_scans(id) ON DELETE CASCADE;

-- RLS: Allow authenticated users to insert/select prices (for their receipt scans)
ALTER TABLE prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can insert prices" ON prices;
CREATE POLICY "Authenticated can insert prices"
ON prices FOR INSERT TO authenticated
WITH CHECK (
  receipt_scan_id IN (SELECT id FROM receipt_scans WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can select own prices" ON prices;
CREATE POLICY "Users can select own prices"
ON prices FOR SELECT TO authenticated
USING (
  receipt_scan_id IN (SELECT id FROM receipt_scans WHERE user_id = auth.uid())
);
