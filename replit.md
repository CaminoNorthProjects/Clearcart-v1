# ClearCart v1

## Overview
ClearCart is a grocery price advocacy web application built with React, Vite, Tailwind CSS v4, and TypeScript. It features a mobile-first UI with bottom navigation for Home, Scan, and Credits views. Supabase provides authentication and a profiles table for user data.

## Project Architecture
- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- **Backend**: Supabase (auth + profiles table)
- **Entry Point**: `index.html` → `src/main.tsx` → `src/App.tsx`

## Key Files
- `vite.config.ts` — Vite config (host 0.0.0.0, port 5000, allowedHosts: true)
- `src/App.tsx` — Main app with auth gate and tab-based views
- `src/contexts/AuthContext.tsx` — Auth context provider (session persistence)
- `src/pages/Auth.tsx` — Login/signup page with postal code validation
- `src/components/BottomNav.tsx` — Bottom navigation component
- `src/lib/supabase.ts` — Supabase client
- `src/index.css` — Tailwind CSS entry

## Environment Variables (Secrets)
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anonymous key

## Auth Flow
- Unauthenticated users see the Login/Sign-up screen
- Sign-up requires full name and a valid Vancouver postal code (V prefix)
- Profile data is saved to Supabase `profiles` table on sign-up
- Sessions persist across browser refreshes via Supabase Auth

## Development
- Dev server: `npm run dev` (port 5000)
- Build: `npm run build` (output to `dist/`)

## Deployment
- Static deployment from `dist/` directory
