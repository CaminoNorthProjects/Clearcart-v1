-- ============================================
-- ClearCart Supabase Setup
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Profiles table (stores user names and postal codes)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name text NOT NULL,
  postal_code text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can read own profile"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 2. Receipt scans table
CREATE TABLE IF NOT EXISTS receipt_scans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  image_url text NOT NULL,
  raw_text text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE receipt_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own scans"
ON receipt_scans FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own scans"
ON receipt_scans FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 3. Storage policies for the "receipts" bucket
-- NOTE: You must FIRST create the bucket manually in Supabase Dashboard:
--   Storage > New bucket > name: receipts > Public: ON

CREATE POLICY "Authenticated users can upload receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "Public can read receipts"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'receipts');
