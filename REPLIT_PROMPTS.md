# Replit Alignment Prompts

Copy-paste these prompts when working with Replit AI or onboarding. They ensure alignment with Cursor (Logic Lab) and the ClearCart pipeline.

---

## 1. Project Context (Use First)

```
ClearCart is a grocery price advocacy app for a 20-day launch. Pipeline: Cursor (logic), GitHub (version control), Replit (hosting), Supabase (DB/Auth).

Stack: React 19, Vite 7, TypeScript, Tailwind CSS v4. Mobile-first UI with bottom nav: Home, Scan, Credits.

Key conventions:
- Emerald/gray aesthetic (emerald-600 accent, gray-50 background)
- All pages in src/pages/, lib utilities in src/lib/
- Supabase client in src/lib/supabase.ts (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
- Build output: dist/ (strict in vite.config.ts)
```

---

## 2. Sync Workflow (Before Making Changes)

```
Before editing: Pull from GitHub (git pull origin main) to sync with Cursor.

After editing: Commit and push so Cursor has the latest. Never force-push without coordinating.
```

---

## 3. Phase 4 Context (Data Normalization)

```
Phase 4 is complete. Scan flow: Capture → Upload → OCR → Insert receipt_scans → parseReceiptLines → savePricesToSupabase → fetchCompetitorPrices → Comparison UI.

- src/lib/normalize.ts: parseReceiptLines, normalizeOcrErrors, savePricesToSupabase
- src/lib/compare.ts: fetchCompetitorPrices (mock for MVP), estimateDeliveryPrice
- prices table has receipt_scan_id (run supabase/add-receipt-scan-id-to-prices.sql if missing)
```

---

## 4. Debugging Scan/OCR

```
console.log from React runs in the browser, not Replit's terminal. To see OCR logs: use desktop + DevTools (F12) > Console, or rely on the on-screen OCR preview in the Scan done state.
```

---

## 5. Supabase Setup Checklist

```
Required: profiles, receipt_scans, prices tables. receipts bucket (Public) + RLS policies from supabase/receipts-bucket-policies.sql. prices table needs receipt_scan_id column (add-receipt-scan-id-to-prices.sql). Secrets: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.
```

---

## 6. Quality Gate Verification

```
Quality Gate #4: (1) Items in Supabase prices table with receipt_scan_id, (2) Comparison List in Scan done UI, (3) At least one "Save $X.XX at Superstore" shown.
```
