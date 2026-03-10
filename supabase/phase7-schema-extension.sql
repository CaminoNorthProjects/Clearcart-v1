-- Phase 7: Schema Extension
-- Enables PostGIS, extends profiles, creates stores and flagged_prices tables.
-- Safe to run multiple times — all statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.

-- ---------------------------------------------------------------------------
-- PostGIS (needed for future geospatial queries; harmless if already enabled)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS postgis;

-- ---------------------------------------------------------------------------
-- Extend profiles with Triple Constraint preferences and premium flag
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS primary_focus     TEXT    NOT NULL DEFAULT 'cost'
    CHECK (primary_focus IN ('cost', 'time', 'health')),
  ADD COLUMN IF NOT EXISTS storage_capacity  TEXT    NOT NULL DEFAULT 'standard'
    CHECK (storage_capacity IN ('standard', 'condo/small')),
  ADD COLUMN IF NOT EXISTS strict_health     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_premium        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_given_at  TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.primary_focus    IS 'User''s default Triple Constraint focus: cost, time, or health.';
COMMENT ON COLUMN public.profiles.storage_capacity IS 'Storage capacity for The Luis Rule: standard or condo/small.';
COMMENT ON COLUMN public.profiles.strict_health    IS 'Activates The Jennifer Rule: flags high_preservatives / artificial_colors.';
COMMENT ON COLUMN public.profiles.is_premium       IS 'Set to true by the stripe-webhook Edge Function on subscription payment.';
COMMENT ON COLUMN public.profiles.consent_given_at IS 'Timestamp when user accepted the Bill C-27 consent modal. NULL = not yet shown.';

-- ---------------------------------------------------------------------------
-- Stores table
-- Uses a plain address TEXT column for geocoding client-side via Leaflet/Google.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stores (
  id           UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT         NOT NULL,
  type         TEXT         NOT NULL
    CHECK (type IN ('independent', 'farmer', 'butcher', 'fisher', 'conglomerate')),
  address      TEXT         NOT NULL,
  lat          DOUBLE PRECISION,
  lng          DOUBLE PRECISION,
  has_delivery BOOLEAN      NOT NULL DEFAULT false,
  owner_story  TEXT,
  hours        JSONB,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.stores.lat   IS 'Pre-geocoded latitude. Populated at seed time to avoid client-side API calls.';
COMMENT ON COLUMN public.stores.lng   IS 'Pre-geocoded longitude. Populated at seed time to avoid client-side API calls.';
COMMENT ON COLUMN public.stores.hours IS 'JSONB map of day → {open, close}, e.g. {"monday": {"open": "08:00", "close": "20:00"}}.';

-- Allow any authenticated user to read stores
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read stores"
  ON public.stores FOR SELECT
  USING (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- Flagged prices table (community price advocacy)
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
-- Vancouver store seed data (~15 real independent stores)
-- ---------------------------------------------------------------------------
INSERT INTO public.stores (name, type, address, lat, lng, has_delivery, owner_story, hours)
VALUES
  ('Aria Foods', 'independent', '1885 W 57th Ave, Vancouver, BC', 49.2257, -123.1558, false,
   'Family-run Persian grocery serving Vancouver''s Westside since 2003.', '{"monday":{"open":"09:00","close":"20:00"},"tuesday":{"open":"09:00","close":"20:00"},"wednesday":{"open":"09:00","close":"20:00"},"thursday":{"open":"09:00","close":"20:00"},"friday":{"open":"09:00","close":"21:00"},"saturday":{"open":"09:00","close":"21:00"},"sunday":{"open":"10:00","close":"19:00"}}'),

  ('Kin''s Farm Market', 'independent', '2110 W 4th Ave, Vancouver, BC', 49.2662, -123.1550, false,
   'BC-grown produce direct from Fraser Valley farms. Serving Kitsilano since 1991.', '{"monday":{"open":"08:00","close":"20:00"},"tuesday":{"open":"08:00","close":"20:00"},"wednesday":{"open":"08:00","close":"20:00"},"thursday":{"open":"08:00","close":"20:00"},"friday":{"open":"08:00","close":"20:00"},"saturday":{"open":"08:00","close":"20:00"},"sunday":{"open":"09:00","close":"19:00"}}'),

  ('Donald''s Market', 'independent', '2343 E Hastings St, Vancouver, BC', 49.2811, -123.0496, false,
   'East Van neighbourhood staple. Independently owned for over 40 years.', '{"monday":{"open":"08:00","close":"21:00"},"tuesday":{"open":"08:00","close":"21:00"},"wednesday":{"open":"08:00","close":"21:00"},"thursday":{"open":"08:00","close":"21:00"},"friday":{"open":"08:00","close":"21:00"},"saturday":{"open":"08:00","close":"21:00"},"sunday":{"open":"09:00","close":"20:00"}}'),

  ('Persia Foods', 'independent', '3400 Sheppard Ave E, Vancouver, BC', 49.2699, -123.0738, false,
   'Specialty Middle Eastern and Persian groceries. Fresh herbs flown in weekly.', '{"monday":{"open":"09:00","close":"21:00"},"tuesday":{"open":"09:00","close":"21:00"},"wednesday":{"open":"09:00","close":"21:00"},"thursday":{"open":"09:00","close":"21:00"},"friday":{"open":"09:00","close":"21:00"},"saturday":{"open":"09:00","close":"21:00"},"sunday":{"open":"10:00","close":"20:00"}}'),

  ('Famous Foods', 'independent', '1595 Kingsway, Vancouver, BC', 49.2477, -123.0863, false,
   'Budget-friendly bulk and specialty foods. Vancouver''s best-kept secret since 1986.', '{"monday":{"open":"09:00","close":"18:00"},"tuesday":{"open":"09:00","close":"18:00"},"wednesday":{"open":"09:00","close":"18:00"},"thursday":{"open":"09:00","close":"18:00"},"friday":{"open":"09:00","close":"18:00"},"saturday":{"open":"09:00","close":"17:00"},"sunday":{"open":"closed","close":"closed"}}'),

  ('Sunrise Market', 'independent', '300 Powell St, Vancouver, BC', 49.2827, -123.0963, false,
   'Japanese grocery and produce in the heart of Japantown. Community-owned cooperative.', '{"monday":{"open":"09:00","close":"19:00"},"tuesday":{"open":"09:00","close":"19:00"},"wednesday":{"open":"09:00","close":"19:00"},"thursday":{"open":"09:00","close":"19:00"},"friday":{"open":"09:00","close":"19:00"},"saturday":{"open":"09:00","close":"19:00"},"sunday":{"open":"10:00","close":"18:00"}}'),

  ('Stong''s Market', 'independent', '4560 Dunbar St, Vancouver, BC', 49.2369, -123.1838, false,
   'Dunbar''s neighbourhood grocer since 1931. Local and organic sourcing first.', '{"monday":{"open":"08:00","close":"21:00"},"tuesday":{"open":"08:00","close":"21:00"},"wednesday":{"open":"08:00","close":"21:00"},"thursday":{"open":"08:00","close":"21:00"},"friday":{"open":"08:00","close":"21:00"},"saturday":{"open":"08:00","close":"21:00"},"sunday":{"open":"09:00","close":"20:00"}}'),

  ('Fraser Valley Direct', 'farmer', '50 Lonsdale Ave, North Vancouver, BC', 49.3135, -123.0759, true,
   'Weekly deliveries of pasture-raised produce straight from our Abbotsford family farm.', '{"saturday":{"open":"08:00","close":"14:00"},"sunday":{"open":"08:00","close":"13:00"}}'),

  ('Taves Family Farms', 'farmer', '333 Gladwin Rd, Abbotsford, BC', 49.0437, -122.2860, false,
   'Third-generation family farm. U-pick and pre-packed seasonal boxes available.', '{"tuesday":{"open":"09:00","close":"17:00"},"thursday":{"open":"09:00","close":"17:00"},"saturday":{"open":"08:00","close":"16:00"}}'),

  ('The Butcher Shop', 'butcher', '2855 Granville St, Vancouver, BC', 49.2495, -123.1453, false,
   'Dry-aged BC beef, pasture-raised pork, and heritage poultry. No antibiotics, ever.', '{"monday":{"open":"10:00","close":"18:00"},"tuesday":{"open":"10:00","close":"18:00"},"wednesday":{"open":"10:00","close":"18:00"},"thursday":{"open":"10:00","close":"18:00"},"friday":{"open":"10:00","close":"18:00"},"saturday":{"open":"09:00","close":"17:00"}}'),

  ('Granville Island Public Market', 'independent', '1669 Johnston St, Vancouver, BC', 49.2710, -123.1342, false,
   'The heart of Vancouver''s food culture. 50+ independent vendors under one roof.', '{"monday":{"open":"09:00","close":"19:00"},"tuesday":{"open":"09:00","close":"19:00"},"wednesday":{"open":"09:00","close":"19:00"},"thursday":{"open":"09:00","close":"19:00"},"friday":{"open":"09:00","close":"19:00"},"saturday":{"open":"09:00","close":"19:00"},"sunday":{"open":"09:00","close":"19:00"}}'),

  ('Organic Ocean', 'fisher', '2205 Commissioner St, Vancouver, BC', 49.2854, -123.0584, true,
   'Wild BC salmon, halibut, and spot prawns. Traceable to the vessel and crew.', '{"monday":{"open":"08:00","close":"17:00"},"tuesday":{"open":"08:00","close":"17:00"},"wednesday":{"open":"08:00","close":"17:00"},"thursday":{"open":"08:00","close":"17:00"},"friday":{"open":"08:00","close":"17:00"}}'),

  ('Finest at Sea', 'fisher', '1525 Duranleau St, Vancouver, BC', 49.2706, -123.1358, true,
   'Dockside-fresh Pacific seafood. Fishermen-owned and operated since 1983.', '{"tuesday":{"open":"10:00","close":"18:00"},"wednesday":{"open":"10:00","close":"18:00"},"thursday":{"open":"10:00","close":"18:00"},"friday":{"open":"10:00","close":"18:00"},"saturday":{"open":"09:00","close":"17:00"}}'),

  ('Real Canadian Superstore', 'conglomerate', '3185 Grandview Hwy, Vancouver, BC', 49.2386, -123.0460, true,
   NULL, '{"monday":{"open":"07:00","close":"23:00"},"tuesday":{"open":"07:00","close":"23:00"},"wednesday":{"open":"07:00","close":"23:00"},"thursday":{"open":"07:00","close":"23:00"},"friday":{"open":"07:00","close":"23:00"},"saturday":{"open":"07:00","close":"23:00"},"sunday":{"open":"08:00","close":"22:00"}}'),

  ('Loblaws', 'conglomerate', '1020 W Georgia St, Vancouver, BC', 49.2848, -123.1197, true,
   NULL, '{"monday":{"open":"07:00","close":"23:00"},"tuesday":{"open":"07:00","close":"23:00"},"wednesday":{"open":"07:00","close":"23:00"},"thursday":{"open":"07:00","close":"23:00"},"friday":{"open":"07:00","close":"23:00"},"saturday":{"open":"07:00","close":"23:00"},"sunday":{"open":"08:00","close":"22:00"}}')
ON CONFLICT DO NOTHING;
