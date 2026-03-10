-- Phase 12: Recipes schema
-- Creates recipes and recipe_ingredients tables with RLS.

CREATE TABLE IF NOT EXISTS public.recipes (
  id               UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title            TEXT         NOT NULL,
  health_score     INTEGER      CHECK (health_score BETWEEN 1 AND 10),
  image_url        TEXT,
  prep_time_minutes INTEGER,
  cook_time_minutes INTEGER,
  source_url       TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.recipe_ingredients (
  id         UUID   DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id  UUID   NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  name       TEXT   NOT NULL,
  quantity   TEXT,
  unit       TEXT,
  category   TEXT   CHECK (category IN ('produce', 'meat_seafood', 'dairy', 'pantry', 'other'))
);

-- RLS
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own recipes"
  ON public.recipes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage their own recipe ingredients"
  ON public.recipe_ingredients FOR ALL
  USING (
    recipe_id IN (
      SELECT id FROM public.recipes WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    recipe_id IN (
      SELECT id FROM public.recipes WHERE user_id = auth.uid()
    )
  );
