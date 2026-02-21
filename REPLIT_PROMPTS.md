# Replit Alignment Prompts

Copy-paste these prompts when working with Replit AI or onboarding. They ensure alignment with Cursor (Logic Lab) and the ClearCart pipeline.

---

## 1. Project Context (Use First)

```
ClearCart is a grocery price advocacy app for a 20-day launch. Pipeline: Cursor (logic), GitHub (version control), Replit (hosting), Supabase (DB/Auth).

Stack: React 19, Vite 7, TypeScript, Tailwind CSS v4. Mobile-first UI with bottom nav: Home, Scan, Credits. Emerald/gray aesthetic.

Key files: src/pages/ (Auth, Scan, Home, Credits), src/lib/ (supabase, normalize, compare), src/contexts/AuthContext. Build output: dist/.
```

---

## 2. Sync Workflow (Before Making Changes)

```
Before editing: git pull origin main to sync with Cursor.

After each pull: vite.config.ts may need Replit server settings restored — ensure server has host: '0.0.0.0', port: 5000, allowedHosts: true.

After editing: Commit and push so Cursor has the latest. Never force-push without coordinating.
```

---

## 3. Phase 4 — If Files Are Missing

```
Phase 4 is already built in Cursor and pushed to GitHub. Do NOT rebuild from scratch.

If src/lib/normalize.ts or src/lib/compare.ts do not exist: run git pull origin main first. The Phase 4 code (normalization, comparison UI) is in the repo.

If pull causes merge conflicts, resolve by keeping origin/main version for conflicted files.
```

---

## 4. Phase 4 Context (Data Normalization — When Present)

```
Phase 4 flow: Capture → Upload → OCR → Insert receipt_scans → parseReceiptLines → savePricesToSupabase → fetchCompetitorPrices → Comparison UI.

- src/lib/normalize.ts: parseReceiptLines, normalizeOcrErrors, savePricesToSupabase
- src/lib/compare.ts: fetchCompetitorPrices (mock for MVP), estimateDeliveryPrice
- Scan.tsx: captures receipt_scan.id via .select('id').single(), wires normalization and comparison
```

---

## 5. Supabase Setup (Full Checklist)

```
1. profiles table — Done
2. receipt_scans table — Done
3. prices table — Create if missing:
   CREATE TABLE IF NOT EXISTS prices (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     item_name TEXT NOT NULL,
     price DECIMAL(10,2) NOT NULL,
     unit TEXT,
     store_name TEXT,
     is_delivery_app_price BOOLEAN DEFAULT FALSE,
     scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
4. Run supabase/add-receipt-scan-id-to-prices.sql (adds receipt_scan_id, RLS)
5. receipts bucket (Public) + receipts-bucket-policies.sql — Done
6. Secrets: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY — Done
```

---

## 6. Debugging Scan/OCR

```
console.log from React runs in the browser, not Replit's terminal. To see OCR logs: use desktop + DevTools (F12) > Console, or rely on the on-screen OCR preview in the Scan done state.
```

---

## 7. Quality Gate #4 Verification

```
(1) Items in Supabase prices table with receipt_scan_id
(2) Comparison List visible in Scan done UI
(3) At least one "Save $X.XX at Superstore (est.)" shown
```

---

## 8. Quick Start (Paste When Opening Replit)

```
ClearCart: Cursor (logic) → GitHub → Replit (hosting). Stack: React 19, Vite 7, TS, Tailwind v4.

First: git pull origin main. If Phase 4 files (normalize.ts, compare.ts) are missing, they're in the repo — pull to get them.

After pull: Restore vite.config server (host 0.0.0.0, port 5000, allowedHosts: true) if needed.

Supabase: Ensure prices table exists and add-receipt-scan-id-to-prices.sql has been run.
```
