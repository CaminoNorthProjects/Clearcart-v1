-- Run this in Supabase SQL Editor AFTER creating the 'receipts' bucket (Storage > New bucket > name: receipts, Public: on)
-- Phase 3: Storage RLS policies for receipt uploads

-- Allow authenticated users to upload to receipts bucket
CREATE POLICY "Authenticated users can upload receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts');

-- Allow public read (for public bucket URLs)
CREATE POLICY "Public read for receipts"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'receipts');
