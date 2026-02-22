# Screen Configuration Gap Analysis

## Summary

| Screen | Expected | Current | Status |
|--------|----------|---------|--------|
| Home | Dashboard with Welcome, Balance, Advocacy Highlights | Placeholder (title + tagline only) | **Gaps** |
| Scan | Camera + ComparisonCard; Emerald/Amber rows; Share button | Implemented; minor layout difference | **Aligned** |
| Credits | Balance + History with Local Gem gold badge | Balance + History; no gold badge | **Minor gap** |

---

## 1. Home Screen (Dashboard)

### Expected
- "Welcome Back [Name]" header (from profiles.full_name)
- Large "Current Balance" card with ClearCredits in emerald font
- "Price Advocacy Highlights" section with cards flagging recent community-wide "Questionable Sales" in Vancouver

### Current
- "ClearCart" title
- "Grocery price advocacy at your fingertips." tagline
- No personalization, no balance, no advocacy highlights

### Gaps and Recommendations

| Gap | Recommendation |
|-----|----------------|
| No "Welcome Back [Name]" | Fetch `profiles.full_name` in HomeView; display when available. Fallback: "Welcome Back" if null. |
| No Current Balance | Fetch `profiles.clear_credits` and display in a card (same pattern as Credits page). |
| No Price Advocacy Highlights | Requires new data: community-wide questionable sales. Options: (a) Create a `flagged_prices` or `community_alerts` table; (b) Query `prices` where users have flagged items; (c) Defer to post-launch and show placeholder "Coming soon." |

### Implementation Priority
- **High:** Welcome + Balance (reuse Credits fetch logic or create shared hook)
- **Medium:** Price Advocacy Highlights (needs schema + backend; can defer)

---

## 2. Scan Screen (Vision Engine)

### Expected
- Upper half: live camera viewfinder or "Take Photo" button
- Below: ComparisonCard with Emerald rows (savings) and Amber rows (questionable) + "Share to Community"

### Current
- **Idle:** "Take Photo" button
- **Camera:** Live viewfinder + Capture/Cancel
- **Preview:** Captured image + Upload & Scan / Retake
- **Done:** ComparisonCard with Emerald (Save $X at Store), Amber (Questionable + Share to Community)

### Validation Alignment

| Check | Status | Notes |
|-------|--------|------|
| OCR Accuracy | Implemented | `parseReceiptLines` in normalize.ts |
| Tax Stripping | Implemented | `stripTaxMarkers` removes G, P, H before extraction |
| Double-Tap Guard | Implemented | `uploadingRef` in Scan.tsx blocks re-entry |

### Minor Difference
- Expected: ComparisonCard "below" camera during scan. Current: ComparisonCard only visible in "done" state (after upload). This is correct UX—you cannot compare before scanning.

**Verdict:** Scan screen is configured as expected.

---

## 3. Credits Screen (Rewards Hub)

### Expected
- Vertically scrolling "Reward History"
- Each entry: store name, date, credits earned
- Local Gem: small gold badge + "+25"
- Standard: "+10"

### Current
- Balance card at top
- "Recent scans" list with store name, date, +credits
- All entries styled the same (emerald +credits); no gold badge for Local Gem

### Gaps and Recommendations

| Gap | Recommendation |
|-----|----------------|
| No gold badge for Local Gem | Add conditional styling: when `scan.store_type === 'Local Gem'`, render a small badge (e.g. amber/gold pill or icon) next to "+25". |
| Schema note | Validation says "credits_awarded set to true"—actual schema uses `credits_awarded INTEGER` (10 or 25). Validate with `credits_awarded IS NOT NULL` instead. |

### Implementation
- In Credits.tsx history list item: `{scan.store_type === 'Local Gem' && <span className="...">Local Gem</span>}` before the +credits span.

**Verdict:** Credits screen is mostly aligned; add Local Gem badge for full compliance.

---

## 4. Final Validation Protocol

### End-to-End Loop (Phase 6 Sign-Off)

| Step | What to Validate | Current Support |
|------|------------------|------------------|
| Sign In | Emerald login screen accepts credentials | Auth.tsx has emerald styling |
| Scan | Photo from Local Gem (Aria, Donald's) | `extractStoreFromOcr` detects Local Gems |
| Analyze | At least one "Questionable Sale" if paid above market | ComparisonCard shows amber when >20% over |
| Reward | Credits tab shows +25 for Local Gem | RPC awards 25; Credits displays it |

**Note:** "Donald's Market" is in LOCAL_GEMS as "donald's" / "donalds market". "Aria" is in the list. Ensure receipt OCR text contains these strings (e.g. "ARIA" or "DONALD'S" in first ~10 lines).

---

## 5. Recommended Implementation Order

1. **Home Dashboard (High):** Add Welcome Back [Name] + Current Balance to HomeView. Fetch profile (full_name, clear_credits) when Home tab is visible.
2. **Credits Local Gem Badge (Low):** Add gold/amber "Local Gem" badge next to +25 entries.
3. **Price Advocacy Highlights (Defer):** Requires community data model. Add "Coming soon" placeholder or skip for Phase 6.

---

## 6. Schema Clarification

- `receipt_scans.credits_awarded` is `INTEGER` (10 or 25), not boolean.
- Validation: "credits_awarded is set" = `credits_awarded IS NOT NULL` (or `> 0`).
- The RPC `award_scan_credits` sets this column atomically.
