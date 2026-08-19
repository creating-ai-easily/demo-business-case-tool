# Business Case Builder — MARKT-PILOT Edition

A single-page, no-build-step tool that supports live sales conversations by
building a prospect's ROI business case in front of them — process by
process — instead of presenting a generic slide.

Built for Becci to use solo, live, screen-shared or in person, one
conversation at a time. See `businesscasebuilderspec.md`-style requirements
in this repo's history for the full product spec.

## Running it

Open `index.html` in any modern browser — no server, no build step, no
dependencies. That's the whole app.

## How it works

- **Five-step guided flow:** Prospect & Use Case → Without the Tool →
  With MARKT-PILOT → Before/After → Risks & Roadmap. The sidebar lets you
  jump to any step at any time — the flow is a recommended sequence, not
  an enforced one.
- **Shared process-step list:** each step (name + hours/week) has a
  baseline ("without") and target ("with") value, so every row has a
  visible before/after. A quick-apply slider can cut all rows by a uniform
  % in one click; individual rows stay editable afterward.
- **Live numbers:** a sticky summary bar (time saved, cost savings, ROI,
  payback) animates on every input, on every step after the first —
  reinforcing that the business case is being built together, not just
  shown.
- **Per-prospect autosave:** data is saved locally in the browser
  (`localStorage`, personal to that device, no login, no server) under one
  key per prospect, debounced ~700ms after the last edit. Use the
  dropdown in the top bar to switch between in-progress conversations, or
  "+ New prospect" to start a fresh record pre-populated with the
  MARKT-PILOT process template.
- **Risks & roadmap:** an editable risk list with a "discussed" checkbox
  for live call tracking, plus an editable 3-phase roadmap.
- **Copy summary:** a plain-text recap (company, use case, savings, ROI,
  payback, next step) copied to the clipboard for a follow-up email, with
  a manual-selection fallback if clipboard access is blocked.

All monetary/investment figures are illustrative placeholders until
updated with the prospect's real numbers — flagged in-app.

## Data & privacy

Everything is stored client-side in the browser's `localStorage` on
Becci's own device — nothing is sent to a server, there's no login, and
data isn't shared between users. This matches the tool's intended usage:
personal, single-user, no sensitive data beyond company/contact names.
