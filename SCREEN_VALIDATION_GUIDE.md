# ClearCart Screen Validation Guide

## Screen Layout Overview

All three screens share:
- **Top:** Content area (gray-50 background)
- **Bottom:** Fixed navigation bar with Home | Scan | Credits (emerald when active)
- **Toast:** When triggered, appears above the nav bar (emerald bar, white text)

---

## 1. Home Screen

### What You Should See

```
┌─────────────────────────────────────┐
│                                     │
│           ClearCart                  │
│     (text-2xl, bold, gray-900)      │
│                                     │
│  Grocery price advocacy at your     │
│  fingertips.                        │
│  (text-sm, gray-600)                │
│                                     │
│                                     │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│   Home    │   Scan    │   Credits   │
│  (active) │           │             │
└─────────────────────────────────────┘
```

### Validation

| Check | How to Verify |
|-------|---------------|
| Title visible | "ClearCart" appears centered, large and bold |
| Tagline visible | "Grocery price advocacy at your fingertips." below title |
| Nav bar | Home tab highlighted in emerald; Scan and Credits in gray |
| No errors | No red text or loading spinner stuck |

---

## 2. Scan Screen

### States and What You Should See

#### 2a. Idle (Initial)

```
┌─────────────────────────────────────┐
│         Scan Receipt                │
│  Take a photo of your receipt...    │
│                                     │
│  ┌─────────────────────────────┐   │
│  │       Take Photo            │   │  <- emerald button
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

#### 2b. Camera (After "Take Photo")

```
┌─────────────────────────────────────┐
│         Scan Receipt                │
│                                     │
│  ┌─────────────────────────────┐   │
│  │                             │   │
│  │     LIVE CAMERA FEED        │   │
│  │     (video element)        │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│  [ Capture ]  [ Cancel ]            │
└─────────────────────────────────────┘
```

#### 2c. Preview (After "Capture")

```
┌─────────────────────────────────────┐
│         Scan Receipt                │
│                                     │
│  ┌─────────────────────────────┐   │
│  │   CAPTURED RECEIPT IMAGE    │   │
│  └─────────────────────────────┘   │
│  [ Upload & Scan ]  [ Retake ]      │
└─────────────────────────────────────┘
```

#### 2d. Uploading / Scanning Market

```
┌─────────────────────────────────────┐
│         Scan Receipt                │
│                                     │
│  Uploading and extracting text...  │
│  (or)                               │
│  Scanning Market...                 │
│  Comparing prices with Superstore   │
└─────────────────────────────────────┘
```

#### 2e. Done (Success)

```
┌─────────────────────────────────────┐
│         Scan Receipt                │
│                                     │
│  Receipt scanned successfully.      │  <- emerald text
│                                     │
│  ┌─ Comparison List ─────────────┐  │
│  │ MILK 2%                       │  │
│  │ You paid: $4.99               │  │
│  │ Save $0.50 at Superstore      │  │  <- emerald row
│  ├───────────────────────────────┤  │
│  │ BREAD                         │  │
│  │ You paid: $5.99               │  │
│  │ Questionable: Superstore $4.50│  │  <- amber row
│  │ [ Share to Community ]        │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌─ Raw OCR (preview) ──────────┐   │
│  │ LOBLAWS MILK 4.99...         │   │
│  └───────────────────────────────┘   │
│                                     │
│  [ Scan Another ]                    │
└─────────────────────────────────────┘
```

#### 2f. Toast (When Credits Earned)

```
┌─────────────────────────────────────┐
│  Success! +10 ClearCredits added    │  <- emerald bar, above nav
└─────────────────────────────────────┘
```

### Validation

| Check | How to Verify |
|-------|---------------|
| Take Photo | Button visible; tap opens camera (or prompts permission) |
| Camera | Live feed shows; Capture and Cancel buttons work |
| Preview | Captured image shown; Upload & Scan and Retake visible |
| Upload flow | "Uploading..." then "Scanning Market..." appear |
| Done state | "Receipt scanned successfully." + Comparison List + Raw OCR preview |
| Emerald rows | Items where you paid less than competitor (savings) |
| Amber rows | Items where you paid >20% more than competitor (questionable) |
| Share button | On questionable rows; shows toast "Price flagged for the Vancouver community" |
| Credits toast | After scan with credits: "Success! +10 ClearCredits added" (or +25 for Local Gem) |
| Scan Another | Returns to idle; can start new scan |

---

## 3. Credits Screen

### What You Should See

```
┌─────────────────────────────────────┐
│         ClearCredits                │
│  Your balance and scan history.     │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ BALANCE                     │   │
│  │ 35 credits                  │   │  <- large emerald number
│  └─────────────────────────────┘   │
│                                     │
│  Recent scans                       │
│  ┌─────────────────────────────┐   │
│  │ Loblaws        Feb 20, 2025 │   │
│  │                    +10      │   │
│  ├─────────────────────────────┤   │
│  │ Kin's Market   Feb 19, 2025 │   │
│  │                    +25      │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Validation

| Check | How to Verify |
|-------|---------------|
| Balance | Shows "X credits" in large emerald text |
| History | List of scans with store name, date, and +credits |
| Empty state | "No scans with credits yet. Scan a receipt to earn!" when no history |
| Live update | After scanning, switch to Credits tab; balance and new scan appear |
| Local Gem | Scans from Local Gems (e.g. Kin's) show +25 |

---

## Quality Gate Quick Reference

| Gate | Validation |
|------|------------|
| #2 Auth | Login/Sign up works; redirects to Home; session persists on refresh |
| #3 Scan | Camera permission; image in Supabase Storage; OCR text visible |
| #4 Comparison | Items in prices table; Comparison List shows; at least one price difference |
| #5 Credits | Local Gem +25, Standard +10; balance updates; history visible |
| #6 Launch | 10/10 testers pass; storage under 1 GB; no 127/404 errors |
