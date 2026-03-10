-- =============================================================================
-- ClearCart Master Setup
-- Run this ONCE on a fresh Supabase project (e.g. a new Canadian-region instance).
--
-- Creates all tables, RLS policies, RPCs, and store seed data in a single pass.
-- No ALTER TABLE statements — every table is created with all columns from the
-- start, so there are no ordering dependencies.
--
-- After this script succeeds:
--   1. Create the 'receipts' Storage bucket manually in the Supabase Dashboard
--      (Storage → New bucket → name: receipts → Public: On)
--   2. Run the two storage policies at the bottom of this file as a second query.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS postgis;

-- ---------------------------------------------------------------------------
-- PROFILES
-- Extends auth.users. Populated on sign-up by the app via upsert.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id                UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name         TEXT,
  postal_code       TEXT,
  clear_credits     INTEGER      NOT NULL DEFAULT 0,
  is_beta_tester    BOOLEAN      NOT NULL DEFAULT false,
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  -- Triple Constraint preferences
  primary_focus     TEXT         NOT NULL DEFAULT 'cost'
    CHECK (primary_focus IN ('cost', 'time', 'health')),
  storage_capacity  TEXT         NOT NULL DEFAULT 'standard'
    CHECK (storage_capacity IN ('standard', 'condo/small')),
  strict_health     BOOLEAN      NOT NULL DEFAULT false,
  is_premium        BOOLEAN      NOT NULL DEFAULT false,
  -- Bill C-27 consent timestamp (NULL = consent modal not yet shown)
  consent_given_at  TIMESTAMPTZ
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- ---------------------------------------------------------------------------
-- RECEIPT_SCANS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.receipt_scans (
  id              UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url       TEXT,
  raw_text        TEXT,
  store_name      TEXT,
  store_type      TEXT,
  credits_awarded INTEGER,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE public.receipt_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own receipt_scans"
  ON public.receipt_scans FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own receipt_scans"
  ON public.receipt_scans FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- PRICES
-- Includes all columns from all phases — no ALTER TABLE needed.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prices (
  id                    UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  item_name             TEXT          NOT NULL,
  price                 DECIMAL(10,2) NOT NULL,
  unit                  TEXT,
  store_name            TEXT,
  is_delivery_app_price BOOLEAN       NOT NULL DEFAULT false,
  receipt_scan_id       UUID          REFERENCES public.receipt_scans(id) ON DELETE CASCADE,
  scanned_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  -- Triple Constraint / Luis Rule / Jennifer Rule attributes
  is_perishable         BOOLEAN       NOT NULL DEFAULT false,
  is_bulk_discount      BOOLEAN       NOT NULL DEFAULT false,
  health_flags          TEXT[]        NOT NULL DEFAULT '{}',
  is_green_certified    BOOLEAN       NOT NULL DEFAULT false,
  is_farm_direct        BOOLEAN       NOT NULL DEFAULT false
);

ALTER TABLE public.prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can insert prices"
  ON public.prices FOR INSERT TO authenticated
  WITH CHECK (
    receipt_scan_id IN (SELECT id FROM receipt_scans WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can select own prices"
  ON public.prices FOR SELECT TO authenticated
  USING (
    receipt_scan_id IN (SELECT id FROM receipt_scans WHERE user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- STORES
-- Pre-geocoded lat/lng so the map renders without client-side API calls.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stores (
  id           UUID             DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT             NOT NULL,
  type         TEXT             NOT NULL
    CHECK (type IN ('independent', 'farmer', 'butcher', 'fisher', 'conglomerate')),
  address      TEXT             NOT NULL,
  lat          DOUBLE PRECISION,
  lng          DOUBLE PRECISION,
  has_delivery BOOLEAN          NOT NULL DEFAULT false,
  owner_story  TEXT,
  hours        JSONB,
  created_at   TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read stores"
  ON public.stores FOR SELECT
  USING (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- FLAGGED_PRICES
-- Community price advocacy — written by ComparisonCard "Share to Community" button.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.flagged_prices (
  id            UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  price_id      UUID          REFERENCES public.prices(id) ON DELETE SET NULL,
  user_id       UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name    TEXT,
  item_name     TEXT,
  flagged_price DECIMAL(10,2),
  flagged_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE public.flagged_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own flags"
  ON public.flagged_prices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone authenticated can read flags"
  ON public.flagged_prices FOR SELECT
  USING (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- RECIPES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recipes (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title             TEXT        NOT NULL,
  health_score      INTEGER     CHECK (health_score BETWEEN 1 AND 10),
  image_url         TEXT,
  prep_time_minutes INTEGER,
  cook_time_minutes INTEGER,
  source_url        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own recipes"
  ON public.recipes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- RECIPE_INGREDIENTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recipe_ingredients (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id  UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  quantity   TEXT,
  unit       TEXT,
  category   TEXT CHECK (category IN ('produce', 'meat_seafood', 'dairy', 'pantry', 'other'))
);

ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own recipe ingredients"
  ON public.recipe_ingredients FOR ALL
  USING (
    recipe_id IN (SELECT id FROM public.recipes WHERE user_id = auth.uid())
  )
  WITH CHECK (
    recipe_id IN (SELECT id FROM public.recipes WHERE user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- RPC: award_scan_credits
-- Atomic credit award — prevents double-awarding via credits_awarded column.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.award_scan_credits(p_receipt_scan_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    UUID;
  v_store_type TEXT;
  v_credits    INTEGER;
BEGIN
  SELECT user_id, COALESCE(store_type, 'Standard')
  INTO v_user_id, v_store_type
  FROM receipt_scans
  WHERE id = p_receipt_scan_id;

  IF v_user_id IS NULL THEN RETURN 0; END IF;
  IF v_user_id != auth.uid() THEN RETURN 0; END IF;
  IF EXISTS (
    SELECT 1 FROM receipt_scans
    WHERE id = p_receipt_scan_id AND credits_awarded IS NOT NULL
  ) THEN RETURN 0; END IF;

  v_credits := CASE WHEN v_store_type ILIKE 'Local Gem' THEN 25 ELSE 10 END;

  UPDATE profiles
  SET clear_credits = COALESCE(clear_credits, 0) + v_credits,
      updated_at    = NOW()
  WHERE id = auth.uid();

  UPDATE receipt_scans
  SET credits_awarded = v_credits
  WHERE id = p_receipt_scan_id;

  RETURN v_credits;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: export_user_data  (Bill C-27 — right of access)
-- Returns all rows belonging to the calling user as a JSON object.
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
    'receipt_scans',  (SELECT json_agg(r)    FROM receipt_scans r WHERE r.user_id = auth.uid()),
    'prices',         (
      SELECT json_agg(pr)
      FROM prices pr
      WHERE pr.receipt_scan_id IN (
        SELECT id FROM receipt_scans WHERE user_id = auth.uid()
      )
    ),
    'flagged_prices', (SELECT json_agg(fp)  FROM flagged_prices fp WHERE fp.user_id = auth.uid()),
    'recipes',        (SELECT json_agg(rec) FROM recipes rec        WHERE rec.user_id = auth.uid()),
    'exported_at',    NOW()
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.export_user_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.export_user_data() TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: delete_user_data  (Bill C-27 — right of erasure)
-- Deletes all user-owned rows. The auth.users row is removed separately
-- via the Express server /api/delete-account route (requires service role key).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_user_data()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Recipes cascade to recipe_ingredients via FK
  DELETE FROM public.recipes        WHERE user_id = auth.uid();
  DELETE FROM public.flagged_prices WHERE user_id = auth.uid();
  DELETE FROM public.prices
    WHERE receipt_scan_id IN (
      SELECT id FROM receipt_scans WHERE user_id = auth.uid()
    );
  DELETE FROM public.receipt_scans WHERE user_id = auth.uid();
  DELETE FROM public.profiles       WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_data() TO authenticated;

-- ---------------------------------------------------------------------------
-- STORE SEED DATA — 15 real Vancouver-area locations
-- ON CONFLICT DO NOTHING makes this safe to re-run.
-- ---------------------------------------------------------------------------
INSERT INTO public.stores (name, type, address, lat, lng, has_delivery, owner_story, hours)
VALUES
  ('Aria Foods',
   'independent', '1885 W 57th Ave, Vancouver, BC', 49.2257, -123.1558, false,
   'Family-run Persian grocery serving Vancouver''s Westside since 2003.',
   '{"monday":{"open":"09:00","close":"20:00"},"tuesday":{"open":"09:00","close":"20:00"},"wednesday":{"open":"09:00","close":"20:00"},"thursday":{"open":"09:00","close":"20:00"},"friday":{"open":"09:00","close":"21:00"},"saturday":{"open":"09:00","close":"21:00"},"sunday":{"open":"10:00","close":"19:00"}}'),

  ('Kin''s Farm Market',
   'independent', '2110 W 4th Ave, Vancouver, BC', 49.2662, -123.1550, false,
   'BC-grown produce direct from Fraser Valley farms. Serving Kitsilano since 1991.',
   '{"monday":{"open":"08:00","close":"20:00"},"tuesday":{"open":"08:00","close":"20:00"},"wednesday":{"open":"08:00","close":"20:00"},"thursday":{"open":"08:00","close":"20:00"},"friday":{"open":"08:00","close":"20:00"},"saturday":{"open":"08:00","close":"20:00"},"sunday":{"open":"09:00","close":"19:00"}}'),

  ('Donald''s Market',
   'independent', '2343 E Hastings St, Vancouver, BC', 49.2811, -123.0496, false,
   'East Van neighbourhood staple. Independently owned for over 40 years.',
   '{"monday":{"open":"08:00","close":"21:00"},"tuesday":{"open":"08:00","close":"21:00"},"wednesday":{"open":"08:00","close":"21:00"},"thursday":{"open":"08:00","close":"21:00"},"friday":{"open":"08:00","close":"21:00"},"saturday":{"open":"08:00","close":"21:00"},"sunday":{"open":"09:00","close":"20:00"}}'),

  ('Persia Foods',
   'independent', '3400 Sheppard Ave E, Vancouver, BC', 49.2699, -123.0738, false,
   'Specialty Middle Eastern and Persian groceries. Fresh herbs flown in weekly.',
   '{"monday":{"open":"09:00","close":"21:00"},"tuesday":{"open":"09:00","close":"21:00"},"wednesday":{"open":"09:00","close":"21:00"},"thursday":{"open":"09:00","close":"21:00"},"friday":{"open":"09:00","close":"21:00"},"saturday":{"open":"09:00","close":"21:00"},"sunday":{"open":"10:00","close":"20:00"}}'),

  ('Famous Foods',
   'independent', '1595 Kingsway, Vancouver, BC', 49.2477, -123.0863, false,
   'Budget-friendly bulk and specialty foods. Vancouver''s best-kept secret since 1986.',
   '{"monday":{"open":"09:00","close":"18:00"},"tuesday":{"open":"09:00","close":"18:00"},"wednesday":{"open":"09:00","close":"18:00"},"thursday":{"open":"09:00","close":"18:00"},"friday":{"open":"09:00","close":"18:00"},"saturday":{"open":"09:00","close":"17:00"},"sunday":{"open":"closed","close":"closed"}}'),

  ('Sunrise Market',
   'independent', '300 Powell St, Vancouver, BC', 49.2827, -123.0963, false,
   'Japanese grocery and produce in the heart of Japantown. Community-owned cooperative.',
   '{"monday":{"open":"09:00","close":"19:00"},"tuesday":{"open":"09:00","close":"19:00"},"wednesday":{"open":"09:00","close":"19:00"},"thursday":{"open":"09:00","close":"19:00"},"friday":{"open":"09:00","close":"19:00"},"saturday":{"open":"09:00","close":"19:00"},"sunday":{"open":"10:00","close":"18:00"}}'),

  ('Stong''s Market',
   'independent', '4560 Dunbar St, Vancouver, BC', 49.2369, -123.1838, false,
   'Dunbar''s neighbourhood grocer since 1931. Local and organic sourcing first.',
   '{"monday":{"open":"08:00","close":"21:00"},"tuesday":{"open":"08:00","close":"21:00"},"wednesday":{"open":"08:00","close":"21:00"},"thursday":{"open":"08:00","close":"21:00"},"friday":{"open":"08:00","close":"21:00"},"saturday":{"open":"08:00","close":"21:00"},"sunday":{"open":"09:00","close":"20:00"}}'),

  ('Fraser Valley Direct',
   'farmer', '50 Lonsdale Ave, North Vancouver, BC', 49.3135, -123.0759, true,
   'Weekly deliveries of pasture-raised produce straight from our Abbotsford family farm.',
   '{"saturday":{"open":"08:00","close":"14:00"},"sunday":{"open":"08:00","close":"13:00"}}'),

  ('Taves Family Farms',
   'farmer', '333 Gladwin Rd, Abbotsford, BC', 49.0437, -122.2860, false,
   'Third-generation family farm. U-pick and pre-packed seasonal boxes available.',
   '{"tuesday":{"open":"09:00","close":"17:00"},"thursday":{"open":"09:00","close":"17:00"},"saturday":{"open":"08:00","close":"16:00"}}'),

  ('The Butcher Shop',
   'butcher', '2855 Granville St, Vancouver, BC', 49.2495, -123.1453, false,
   'Dry-aged BC beef, pasture-raised pork, and heritage poultry. No antibiotics, ever.',
   '{"monday":{"open":"10:00","close":"18:00"},"tuesday":{"open":"10:00","close":"18:00"},"wednesday":{"open":"10:00","close":"18:00"},"thursday":{"open":"10:00","close":"18:00"},"friday":{"open":"10:00","close":"18:00"},"saturday":{"open":"09:00","close":"17:00"}}'),

  ('Granville Island Public Market',
   'independent', '1669 Johnston St, Vancouver, BC', 49.2710, -123.1342, false,
   'The heart of Vancouver''s food culture. 50+ independent vendors under one roof.',
   '{"monday":{"open":"09:00","close":"19:00"},"tuesday":{"open":"09:00","close":"19:00"},"wednesday":{"open":"09:00","close":"19:00"},"thursday":{"open":"09:00","close":"19:00"},"friday":{"open":"09:00","close":"19:00"},"saturday":{"open":"09:00","close":"19:00"},"sunday":{"open":"09:00","close":"19:00"}}'),

  ('Organic Ocean',
   'fisher', '2205 Commissioner St, Vancouver, BC', 49.2854, -123.0584, true,
   'Wild BC salmon, halibut, and spot prawns. Traceable to the vessel and crew.',
   '{"monday":{"open":"08:00","close":"17:00"},"tuesday":{"open":"08:00","close":"17:00"},"wednesday":{"open":"08:00","close":"17:00"},"thursday":{"open":"08:00","close":"17:00"},"friday":{"open":"08:00","close":"17:00"}}'),

  ('Finest at Sea',
   'fisher', '1525 Duranleau St, Vancouver, BC', 49.2706, -123.1358, true,
   'Dockside-fresh Pacific seafood. Fishermen-owned and operated since 1983.',
   '{"tuesday":{"open":"10:00","close":"18:00"},"wednesday":{"open":"10:00","close":"18:00"},"thursday":{"open":"10:00","close":"18:00"},"friday":{"open":"10:00","close":"18:00"},"saturday":{"open":"09:00","close":"17:00"}}'),

  ('Real Canadian Superstore',
   'conglomerate', '3185 Grandview Hwy, Vancouver, BC', 49.2386, -123.0460, true,
   NULL,
   '{"monday":{"open":"07:00","close":"23:00"},"tuesday":{"open":"07:00","close":"23:00"},"wednesday":{"open":"07:00","close":"23:00"},"thursday":{"open":"07:00","close":"23:00"},"friday":{"open":"07:00","close":"23:00"},"saturday":{"open":"07:00","close":"23:00"},"sunday":{"open":"08:00","close":"22:00"}}'),

  ('Loblaws',
   'conglomerate', '1020 W Georgia St, Vancouver, BC', 49.2848, -123.1197, true,
   NULL,
   '{"monday":{"open":"07:00","close":"23:00"},"tuesday":{"open":"07:00","close":"23:00"},"wednesday":{"open":"07:00","close":"23:00"},"thursday":{"open":"07:00","close":"23:00"},"friday":{"open":"07:00","close":"23:00"},"saturday":{"open":"07:00","close":"23:00"},"sunday":{"open":"08:00","close":"22:00"}}')

ON CONFLICT DO NOTHING;

-- =============================================================================
-- STORAGE POLICIES
-- Run these AFTER creating the 'receipts' bucket in the Supabase Dashboard:
--   Storage → New bucket → name: receipts → Public: On → Save
--
-- Then paste and run these two statements as a second query:
-- =============================================================================

-- CREATE POLICY "Authenticated users can upload receipts"
--   ON storage.objects FOR INSERT TO authenticated
--   WITH CHECK (bucket_id = 'receipts');
--
-- CREATE POLICY "Public read for receipts"
--   ON storage.objects FOR SELECT TO public
--   USING (bucket_id = 'receipts');
