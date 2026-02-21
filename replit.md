# ClearCart v1

## Overview
ClearCart is a grocery price advocacy web application built with React, Vite, Tailwind CSS v4, and TypeScript. It features a mobile-first UI with bottom navigation for Home, Scan, and Credits views. Supabase provides authentication, profiles table, storage (receipts bucket), and receipt_scans table.

## Project Architecture
- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- **Backend**: Supabase (auth + profiles table + storage + receipt_scans table)
- **OCR**: tesseract.js (client-side Optical Character Recognition)
- **Entry Point**: `index.html` → `src/main.tsx` → `src/App.tsx`

## Key Files
- `vite.config.ts` — Vite config (host 0.0.0.0, port 5000, allowedHosts: true)
- `src/App.tsx` — Main app with auth gate and tab-based views
- `src/contexts/AuthContext.tsx` — Auth context provider (session persistence)
- `src/pages/Auth.tsx` — Login/signup page with postal code validation
- `src/pages/Scan.tsx` — Receipt scanner with camera capture, Supabase upload, and OCR
- `src/components/BottomNav.tsx` — Bottom navigation component
- `src/lib/supabase.ts` — Supabase client
- `src/index.css` — Tailwind CSS entry
- `supabase/receipts-bucket-policies.sql` — SQL for receipts bucket RLS and receipt_scans table

## Environment Variables
- `VITE_SUPABASE_URL` — Supabase project URL (set as shared env var)
- `VITE_SUPABASE_ANON_KEY` — Supabase anonymous key (set as shared env var)

## Auth Flow
- Unauthenticated users see the Login/Sign-up screen
- Sign-up requires full name and a valid Vancouver postal code (V prefix)
- Profile data is saved to Supabase `profiles` table on sign-up
- Email confirmation is disabled
- Sessions persist across browser refreshes via Supabase Auth

## Scan Flow (Phase 3)
- Camera permission prompt via getUserMedia (rear camera preferred, falls back to front)
- Preview captured photo before upload
- Upload to Supabase Storage `receipts` bucket
- Client-side OCR via tesseract.js
- Raw OCR text logged to console as `[ClearCart OCR] Raw text:`
- Results saved to `receipt_scans` table

## Supabase Setup Required
- `profiles` table with RLS policies (INSERT/UPDATE/SELECT for own profile)
- `receipts` storage bucket (Public: on)
- `receipt_scans` table (created via supabase/receipts-bucket-policies.sql)
- Storage and table RLS policies (run supabase/receipts-bucket-policies.sql)

## Development
- Dev server: `npm run dev` (port 5000)
- Build: `npm run build` (output to `dist/`)

## Deployment
- Static deployment from `dist/` directory

## Recent Changes
- 2026-02-21: Fixed Supabase URL and anon key (were pointing to wrong project)
- 2026-02-21: Disabled email confirmation in Supabase
- 2026-02-21: Added Phase 3 Scan page with camera, upload, OCR
- 2026-02-21: Set env vars as shared (not secrets) for reliable propagation
