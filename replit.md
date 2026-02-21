# ClearCart v1

## Overview
ClearCart is a grocery price advocacy web application built with React, Vite, Tailwind CSS v4, and TypeScript. It features a mobile-first UI with bottom navigation for Home, Scan, and Credits views. Supabase provides authentication, profiles table, storage (receipts bucket), and receipt_scans table. Client-side OCR via tesseract.js.

## Project Architecture
- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- **Backend**: Supabase (auth + profiles + storage + receipt_scans)
- **OCR**: tesseract.js (client-side)
- **Entry Point**: `index.html` → `src/main.tsx` → `src/App.tsx`

## Key Files
- `vite.config.ts` — Vite config (host 0.0.0.0, port 5000, allowedHosts: true for Replit)
- `src/App.tsx` — Main app with auth gate and tab-based views
- `src/contexts/AuthContext.tsx` — Auth context provider (session persistence)
- `src/pages/Auth.tsx` — Login/signup with name and Vancouver postal code
- `src/pages/Scan.tsx` — Receipt scanner with camera, Supabase upload, and OCR
- `src/components/BottomNav.tsx` — Bottom navigation component
- `src/lib/supabase.ts` — Supabase client
- `src/index.css` — Tailwind CSS entry
- `supabase/setup.sql` — SQL for profiles, receipt_scans, and storage RLS policies
- `.env.example` — Template for environment variables

## Environment Variables
- `VITE_SUPABASE_URL` — Supabase project URL (set as shared env var)
- `VITE_SUPABASE_ANON_KEY` — Supabase anonymous key (set as shared env var)

## Auth Flow
- Unauthenticated users see the Login/Sign-up screen
- Sign-up requires full name and a valid Vancouver postal code (V prefix)
- Profile data saved to Supabase `profiles` table on sign-up
- Email confirmation should be disabled in Supabase
- Sessions persist via Supabase Auth

## Scan Flow (Phase 3)
- Camera permission prompt via getUserMedia (rear camera preferred, front fallback)
- Preview captured photo before upload
- Upload to Supabase Storage `receipts` bucket
- Client-side OCR via tesseract.js
- Raw OCR text logged to console as `[ClearCart OCR] Raw text:`
- Results saved to `receipt_scans` table

## Supabase Setup Required
1. Disable email confirmation: Authentication > Providers > Email > toggle off "Confirm email"
2. Create `receipts` storage bucket: Storage > New bucket > name: receipts > Public: ON
3. Run `supabase/setup.sql` in SQL Editor (creates profiles, receipt_scans, and RLS policies)

## Development
- Dev server: `npm run dev` (port 5000)
- Build: `npm run build` (output to `dist/`)

## Deployment
- Static deployment from `dist/` directory

## Recent Changes
- 2026-02-21: Synced local project to match GitHub repo (reset to base shell)
- 2026-02-21: Rebuilt auth (AuthContext + Auth page with postal code validation)
- 2026-02-21: Rebuilt Scan page with camera capture, Supabase upload, and tesseract.js OCR
- 2026-02-21: Created unified supabase/setup.sql for all database and storage setup
- 2026-02-21: Kept Replit-specific vite server config (host, port, allowedHosts)
