# Business Case Builder — MARKT-PILOT Edition

A tool that supports live sales conversations by building a prospect's ROI
business case in front of them — process by process — instead of
presenting a generic slide. Built for Becci to use solo, live,
screen-shared or in person, then revisited later to follow up or adjust.

This is the **production app**: Next.js (App Router) on Vercel, with a
Supabase Postgres database (project **"Business Use Case Tool"**, EU/
Frankfurt region) so data survives a new device, a cleared cache, or a
different tab. The original single-file HTML prototype (browser
`localStorage` only) is kept at `legacy/business-case-builder-mvp.html`
for reference — it's superseded by this app and no longer maintained.

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router), deployed on Vercel |
| Database | Supabase Postgres, EU (Frankfurt) region |
| Auth | Supabase Auth, single manually-created admin account — no public sign-up |
| Data access | Supabase client + Row Level Security; mutations via Next.js Server Actions |

## Setup

### 1. Supabase project

Using the existing **"Business Use Case Tool"** Supabase project:

1. In the SQL editor, run `supabase/migrations/0001_init.sql` — creates all
   tables, RLS policies, and indexes.
2. Then run `supabase/seed.sql` — seeds the MARKT-PILOT use-case template
   with the same steps/risks/roadmap the MVP prototype shipped with.
3. Under **Authentication → Users**, manually create the one admin
   account (Becci's email + a password). There is no public sign-up flow
   by design.
4. Under **Project Settings → API**, copy the Project URL and anon public
   key.

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

(`SUPABASE_SERVICE_ROLE_KEY` is only needed if you script the seed step
instead of running `supabase/seed.sql` by hand — not required for the app
itself to run.)

### 3. Run locally

```
npm install
npm run dev
```

Visit `http://localhost:3000` — you'll be redirected to `/login`. Sign in
with the admin account created in step 1.3.

### 4. Deploy

Push to Vercel, set the same two `NEXT_PUBLIC_SUPABASE_*` env vars in the
Vercel project settings, deploy. No other configuration needed.

## How it works

- **Dashboard** (`/`) — every prospect, sorted by most recently updated,
  filterable by status (open/won/lost), with at-a-glance savings/ROI/payback.
- **New Prospect** (`/prospects/new`) — pick a use-case template (its
  steps, risks, and roadmap are copied in and become fully independent) or
  start blank.
- **Prospect wizard** (`/prospects/[id]`) — the five-step guided flow:
  Prospect & Use Case → Without the Tool → With MARKT-PILOT → Before/After
  → Risks & Roadmap. The sidebar lets you jump to any step at any time —
  a recommended sequence, not an enforced one. Every input debounces an
  autosave (~700ms) straight to Postgres, with save status (saving/saved/
  failed) always visible. Includes the quick-apply efficiency slider,
  inline over-baseline warning, sticky live summary bar with animated
  count-up, status control (open/won/lost), a "Duplicate" action to start
  a new prospect from an existing one's steps, and a copy-to-clipboard
  summary with manual-selection fallback.
- **Templates** (`/templates`) — CRUD for use-case templates, so a new
  offer beyond MARKT-PILOT can be added without touching code. Editing a
  template never touches prospects already created from it.

All ROI math (`lib/calculations.ts`) lives in exactly one place and is
used by the dashboard, the wizard, and the copy-summary text alike:

```
totalHoursWithout = Σ step.hours_without
totalHoursWith    = Σ step.hours_with
hoursSavedYear    = (totalHoursWithout − totalHoursWith) × 52
costWithoutYear   = totalHoursWithout × hourlyRate × 52
costWithYear      = totalHoursWith × hourlyRate × 52
savingsYear       = costWithoutYear − costWithYear
totalCost3y       = investmentOneTime + investmentRecurring × 3
roi3y (%)         = ((savingsYear × 3) − totalCost3y) / totalCost3y × 100
paybackMonths     = investmentOneTime / ((savingsYear − investmentRecurring) / 12)
```

All monetary/investment figures are illustrative placeholders until
updated with the prospect's real numbers — flagged in-app.

## Data, privacy & security

- Single-user auth (Supabase Auth, manually created — no public sign-up).
- Row Level Security on every prospect-owned table (`owner_id = auth.uid()`,
  enforced even though there's only one user today).
- No payment or government-ID data collected; contact name/email is the
  only PII stored.
- Supabase's automatic backups / point-in-time recovery cover durability —
  no custom backup job needed at this scale.

## What's deliberately out of scope (this iteration)

Team accounts, prospect self-service, live Notion CRM sync, PDF export,
automated email sending, and live MARKT-PILOT pricing integration. The
`notion_page_id` column and single-owner RLS pattern are already in place
so none of these require a schema change to add later.
