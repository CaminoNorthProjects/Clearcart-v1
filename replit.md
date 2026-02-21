# ClearCart v1

## Overview
ClearCart is a grocery price advocacy web application built with React, Vite, Tailwind CSS v4, and TypeScript. It features a mobile-first UI with bottom navigation for Home, Scan, and Credits views. Supabase client is configured for future backend integration.

## Project Architecture
- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- **Backend**: Supabase (client configured, auth/storage not yet implemented)
- **Entry Point**: `index.html` → `src/main.tsx` → `src/App.tsx`

## Key Files
- `vite.config.ts` — Vite config (host 0.0.0.0, port 5000, allowedHosts: true for Replit)
- `src/App.tsx` — Main app with tab-based views (Home, Scan, Credits)
- `src/components/BottomNav.tsx` — Bottom navigation component
- `src/lib/supabase.ts` — Supabase client
- `src/index.css` — Tailwind CSS entry
- `.env.example` — Template for environment variables

## Environment Variables
- `VITE_SUPABASE_URL` — Supabase project URL (set as shared env var)
- `VITE_SUPABASE_ANON_KEY` — Supabase anonymous key (set as shared env var)

## Current State
- Basic shell with 3 tab views (Home, Scan placeholder, Credits placeholder)
- Supabase client initialized but no auth or storage features yet
- Mobile-first layout with bottom navigation
- Synced from GitHub: github.com/CaminoNorthProjects/Clearcart-v1

## Development
- Dev server: `npm run dev` (port 5000)
- Build: `npm run build` (output to `dist/`)

## Deployment
- Static deployment from `dist/` directory

## Recent Changes
- 2026-02-21: Synced local project to match GitHub repo (reset to base shell)
- 2026-02-21: Removed auth, scan/OCR, and SQL files to match GitHub state
- 2026-02-21: Kept Replit-specific vite server config (host, port, allowedHosts)
