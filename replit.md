# ClearCart v1

## Overview
ClearCart is a grocery price advocacy web application built with React, Vite, Tailwind CSS v4, and TypeScript. It features a mobile-first UI with bottom navigation for Home, Scan, and Credits views. Supabase provides authentication, profiles table, storage (receipts bucket), and receipt_scans table. Client-side OCR via tesseract.js.

## Project Architecture
- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- **Backend**: Supabase (auth + profiles + storage + receipt_scans)
- **OCR**: tesseract.js (client-side, uses `Tesseract.recognize` API)
- **Entry Point**: `index.html` → `src/main.tsx` → `src/App.tsx`

## Key Files
- `vite.config.ts` — Vite config (host 0.0.0.0, port 5000, allowedHosts: true for Replit)
- `src/App.tsx` — Main app with auth gate and tab-based views
- `src/contexts/AuthContext.tsx` — Auth context provider (session persistence, throws if used outside provider)
- `src/pages/Auth.tsx` — Login/signup with name and Vancouver postal code validation
- `src/pages/Scan.tsx` — Receipt scanner with camera, upload, OCR, normalization, comparison UI
- `src/lib/normalize.ts` — OCR parsing (parseReceiptLines, savePricesToSupabase)
- `src/lib/compare.ts` — Competitor price fetcher (mock for MVP)
- `src/components/BottomNav.tsx` — Bottom navigation component
- `src/lib/supabase.ts` — Supabase client
- `supabase/receipts-bucket-policies.sql` — Storage RLS policies
- `supabase/add-receipt-scan-id-to-prices.sql` — Phase 4 migration (receipt_scan_id, RLS)
- `REPLIT_PROMPTS.md` — Alignment prompts for Replit AI

## Environment Variables
- `VITE_SUPABASE_URL` — Supabase project URL (set as shared env var)
- `VITE_SUPABASE_ANON_KEY` — Supabase anonymous key (set as shared env var)

## Auth Flow
- Unauthenticated users see the Login/Sign-up screen
- Sign-up requires full name and a valid Vancouver postal code (V prefix)
- Profile data saved to Supabase `profiles` table on sign-up (with onConflict upsert)
- Sign-up also passes metadata via Supabase auth options
- Email confirmation should be disabled in Supabase
- Sessions persist via Supabase Auth

## Scan Flow (Phase 3 + 4)
- Camera permission prompt via getUserMedia (rear camera preferred, front fallback)
- HTTPS check before attempting camera access
- Preview captured photo before upload
- Upload to Supabase Storage `receipts` bucket (flat file naming: userId_timestamp.jpg)
- Client-side OCR via `Tesseract.recognize(blob, 'eng')`
- Raw OCR text logged to console (browser DevTools, not Replit terminal)
- Insert into `receipt_scans` with `.select('id').single()` to capture receipt_scan_id
- Phase 4: `parseReceiptLines` → `savePricesToSupabase` → `fetchCompetitorPrices` → Comparison UI

## Supabase Setup Required
1. Disable email confirmation: Authentication > Providers > Email > toggle off "Confirm email"
2. Create `profiles` table (id uuid PK refs auth.users, full_name text, postal_code text, created_at timestamptz)
3. Create `receipt_scans` table (id uuid PK, user_id uuid refs auth.users, image_url text, raw_text text, created_at timestamptz)
4. Create `prices` table (id, item_name, price, unit, store_name, is_delivery_app_price, scanned_at)
5. Run `supabase/add-receipt-scan-id-to-prices.sql` (adds receipt_scan_id, RLS for prices)
6. Enable RLS on profiles and receipt_scans with appropriate policies
7. Create `receipts` storage bucket: Storage > New bucket > name: receipts > Public: ON
8. Run `supabase/receipts-bucket-policies.sql` in SQL Editor (storage RLS policies)

## Development
- Dev server: `npm run dev` (port 5000)
- Build: `npm run build` (output to `dist/`)

## Deployment
- Static deployment from `dist/` directory

## GitHub Repo
- https://github.com/CaminoNorthProjects/Clearcart-v1

## Replit AI Alignment
See `REPLIT_PROMPTS.md` for copy-paste prompts to ensure alignment with Cursor and project conventions.

## Recent Changes
- 2026-02-20: Phase 4 — normalize.ts, compare.ts, receipt_scan_id migration, Comparison UI
- 2026-02-21: Synced all files to match GitHub origin/main
- 2026-02-21: AuthContext now throws error if useAuth called outside provider
- 2026-02-21: Auth page uses signUp options metadata, onConflict upsert, success message
- 2026-02-21: Scan page uses Tesseract.recognize directly (not createWorker)
- 2026-02-21: SQL file renamed to receipts-bucket-policies.sql (storage policies only)
- 2026-02-21: Kept Replit-specific vite server config (host, port, allowedHosts)
