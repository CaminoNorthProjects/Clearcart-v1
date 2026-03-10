-- Phase 16: Bill C-27 Compliance
-- Adds the export_user_data RPC for the "Download My Data" feature
-- and the delete_user_data RPC for account deletion.
--
-- consent_given_at column was already added in phase7-schema-extension.sql

-- ---------------------------------------------------------------------------
-- RPC: export_user_data
-- Returns all data belonging to the calling user across profiles,
-- receipt_scans, prices, flagged_prices, and recipes.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.export_user_data()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'profile',        (SELECT row_to_json(p) FROM profiles p WHERE p.id = auth.uid()),
    'receipt_scans',  (SELECT json_agg(r) FROM receipt_scans r WHERE r.user_id = auth.uid()),
    'prices',         (
      SELECT json_agg(pr)
      FROM prices pr
      WHERE pr.receipt_scan_id IN (
        SELECT id FROM receipt_scans WHERE user_id = auth.uid()
      )
    ),
    'flagged_prices', (SELECT json_agg(fp) FROM flagged_prices fp WHERE fp.user_id = auth.uid()),
    'recipes',        (SELECT json_agg(rec) FROM recipes rec WHERE rec.user_id = auth.uid()),
    'exported_at',    NOW()
  ) INTO result;

  RETURN result;
END;
$$;

-- Allow authenticated users to call this RPC on their own data
REVOKE ALL ON FUNCTION public.export_user_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.export_user_data() TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: delete_user_data
-- Deletes all user-owned rows. The auth.users row is deleted separately
-- via the server using the service role key (supabase.auth.admin.deleteUser).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_user_data()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete recipes (cascades to recipe_ingredients via FK)
  DELETE FROM public.recipes WHERE user_id = auth.uid();
  -- Delete flagged prices
  DELETE FROM public.flagged_prices WHERE user_id = auth.uid();
  -- Delete prices via receipt_scans FK
  DELETE FROM public.prices
  WHERE receipt_scan_id IN (
    SELECT id FROM receipt_scans WHERE user_id = auth.uid()
  );
  -- Delete receipt scans (cascades storage references via app logic)
  DELETE FROM public.receipt_scans WHERE user_id = auth.uid();
  -- Delete profile
  DELETE FROM public.profiles WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_data() TO authenticated;
