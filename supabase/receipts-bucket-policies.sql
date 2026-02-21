-- Run this SQL in the Supabase SQL Editor after creating the receipts bucket.
-- Supabase Dashboard > Storage > New bucket > name: receipts, Public: on

-- Allow authenticated users to upload receipts
CREATE POLICY "Authenticated users can upload receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts');

-- Allow public reads on receipts
CREATE POLICY "Public can read receipts"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'receipts');

-- Create receipt_scans table if it doesn't exist
CREATE TABLE IF NOT EXISTS receipt_scans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  image_url text NOT NULL,
  raw_text text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on receipt_scans
ALTER TABLE receipt_scans ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own scans
CREATE POLICY "Users can insert own scans"
ON receipt_scans FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow users to read their own scans
CREATE POLICY "Users can read own scans"
ON receipt_scans FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
