# ClearCart v1

## Overview
ClearCart is a grocery price advocacy web application built with React, Vite, Tailwind CSS v4, and TypeScript. It features a mobile-first UI with bottom navigation for Home, Scan, and Credits views. Supabase is configured as the backend (optional — app runs without credentials).

## Project Architecture
- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- **Backend**: Supabase (client configured in `src/lib/supabase.ts`)
- **Entry Point**: `index.html` → `src/main.tsx` → `src/App.tsx`

## Key Files
- `vite.config.ts` — Vite config (host 0.0.0.0, port 5000, allowedHosts: true)
- `src/App.tsx` — Main app with tab-based views
- `src/components/BottomNav.tsx` — Bottom navigation component
- `src/lib/supabase.ts` — Supabase client (gracefully handles missing env vars)
- `src/index.css` — Tailwind CSS entry

## Environment Variables
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anonymous key

## Development
- Dev server: `npm run dev` (port 5000)
- Build: `npm run build` (output to `dist/`)

## Deployment
- Static deployment from `dist/` directory
