-- Phase 5: ClearCredits Gamification Engine
-- Run this in Supabase SQL Editor

-- 0. Ensure RLS for profiles and receipt_scans (if not already present)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile" ON profiles FOR SELECT TO authenticated
USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated
USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can select own receipt_scans" ON receipt_scans;
CREATE POLICY "Users can select own receipt_scans" ON receipt_scans FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own receipt_scans" ON receipt_scans;
CREATE POLICY "Users can insert own receipt_scans" ON receipt_scans FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- 1. Add credits_awarded column to prevent double awarding
ALTER TABLE receipt_scans ADD COLUMN IF NOT EXISTS credits_awarded INTEGER;

-- 2. Create award_scan_credits RPC (atomic, prevents double-award)
CREATE OR REPLACE FUNCTION award_scan_credits(p_receipt_scan_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_store_type TEXT;
  v_credits INTEGER;
BEGIN
  -- Get scan and verify ownership
  SELECT user_id, COALESCE(store_type, 'Standard')
  INTO v_user_id, v_store_type
  FROM receipt_scans
  WHERE id = p_receipt_scan_id;

  IF v_user_id IS NULL THEN
    RETURN 0; -- Scan not found
  END IF;

  IF v_user_id != auth.uid() THEN
    RETURN 0; -- Not owner
  END IF;

  -- Check not already awarded
  IF EXISTS (SELECT 1 FROM receipt_scans WHERE id = p_receipt_scan_id AND credits_awarded IS NOT NULL) THEN
    RETURN 0; -- Already awarded
  END IF;

  -- Compute credits: 25 for Local Gem, 10 for Standard
  v_credits := CASE
    WHEN v_store_type ILIKE 'Local Gem' THEN 25
    ELSE 10
  END;

  -- Atomic update: increment profile, mark scan
  UPDATE profiles
  SET clear_credits = COALESCE(clear_credits, 0) + v_credits,
      updated_at = NOW()
  WHERE id = auth.uid();

  UPDATE receipt_scans
  SET credits_awarded = v_credits
  WHERE id = p_receipt_scan_id;

  RETURN v_credits;
END;
$$;
