# Supabase Prompts

Use these prompts when configuring or troubleshooting Supabase for ClearCart. Run SQL in the Supabase SQL Editor unless otherwise noted.

---

## 1. Project Context (Use First)

```
ClearCart: grocery price advocacy app. Supabase provides Auth, profiles, receipt_scans, prices tables, and receipts storage bucket.

Client uses VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Auth: signInWithPassword, signUp with metadata (full_name, postal_code). Profile upsert on sign-up. Receipt images uploaded to receipts bucket. OCR text and parsed prices saved to receipt_scans and prices.
```

---

## 2. Auth Setup (Dashboard)

```
Authentication > Providers > Email: Disable "Confirm email" so users can sign in immediately after sign-up.

ClearCart sign-up passes user_metadata: full_name, postal_code. App upserts to profiles table on sign-up.
```

---

## 3. Tables — Create in Order

```
1. profiles:
   CREATE TABLE IF NOT EXISTS profiles (
     id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
     full_name TEXT,
     postal_code TEXT,
     clear_credits INTEGER DEFAULT 0,
     is_beta_tester BOOLEAN DEFAULT FALSE,
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

2. receipt_scans:
   CREATE TABLE IF NOT EXISTS receipt_scans (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     user_id UUID REFERENCES auth.users(id),
     image_url TEXT NOT NULL,
     store_name TEXT,
     store_type TEXT DEFAULT 'Standard',
     total_amount DECIMAL(10,2),
     raw_text TEXT,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

3. prices:
   CREATE TABLE IF NOT EXISTS prices (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     item_name TEXT NOT NULL,
     price DECIMAL(10,2) NOT NULL,
     unit TEXT,
     store_name TEXT,
     is_delivery_app_price BOOLEAN DEFAULT FALSE,
     scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
```

---

## 4. Migration — Add receipt_scan_id to prices

```
Run supabase/add-receipt-scan-id-to-prices.sql after prices table exists:

ALTER TABLE prices ADD COLUMN IF NOT EXISTS receipt_scan_id UUID REFERENCES receipt_scans(id) ON DELETE CASCADE;

ALTER TABLE prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can insert prices" ON prices FOR INSERT TO authenticated
WITH CHECK (receipt_scan_id IN (SELECT id FROM receipt_scans WHERE user_id = auth.uid()));

CREATE POLICY "Users can select own prices" ON prices FOR SELECT TO authenticated
USING (receipt_scan_id IN (SELECT id FROM receipt_scans WHERE user_id = auth.uid()));
```

---

## 5. Storage — receipts Bucket

```
Storage > New bucket:
- Name: receipts
- Public: ON (for public image URLs)

Then run supabase/receipts-bucket-policies.sql for RLS.
```

---

## 6. Storage RLS Policies

```
Run in SQL Editor (after creating receipts bucket):

CREATE POLICY "Authenticated users can upload receipts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "Public read for receipts"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'receipts');
```

---

## 7. RLS for profiles and receipt_scans

```
profiles: Users can read/update own row (id = auth.uid()). Insert via app on sign-up.

receipt_scans: Users can insert own rows (user_id = auth.uid()). Users can select own rows.
```

---

## 8. Troubleshooting — Common Errors

```
403 on storage upload: receipts bucket exists but RLS blocks INSERT. Run receipts-bucket-policies.sql.

403 on prices insert: receipt_scan_id RLS requires the receipt_scan to belong to auth.uid(). Ensure Scan.tsx inserts receipt_scans before prices, and user is authenticated.

Missing receipt_scan_id: Run add-receipt-scan-id-to-prices.sql. Prices table must exist first.
```
