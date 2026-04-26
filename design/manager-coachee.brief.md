# Stitch brief — Manager Coachee View

> Phase 1 · role: `manager` · primary persona: Khalid Al-Harthy (Operations Manager)
> Companion mockup: `manager-coachee.html`

## What this screen is for

A line manager's home. Khalid manages 6 directs in Operations. He needs a daily-driver page that
answers, in roughly priority order:

1. **Who needs me right now?** — pending IDP changes, OJT evidence to validate, coaching gaps.
2. **What's the state of my team's development?** — IDP coverage, % progress per person, last
   activity.
3. **Who has no IDP yet?** — gaps in coverage he should action.
4. **Quick drilldown** — click a row, see a condensed IDP without leaving the page; "Open full IDP"
   for the deep view.

This screen is *not* the IDP view itself — it's the team rollup. The full IDP view is the screen
documented in `idp-view.brief.md`.

## Layout — header strip + table + side drawer

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Top app bar                                                                │
├──────────┬─────────────────────────────────────────────────────────────────┤
│ Sidebar  │  Page header: "My team" · counts                                │
│          ├─────────────────────────────────────────────────────────────────┤
│          │  STAT STRIP — 6 directs · 4 with IDPs · 1 awaiting · 2 on track │
│          ├─────────────────────────────────────────────────────────────────┤
│          │  ACTION QUEUE — what's waiting on Khalid (3 cards)              │
│          ├─────────────────────────────────────────────────────────────────┤
│          │  Filter bar: status · gap category · competency · sort          │
│          ├─────────────────────────────────────────────────────────────────┤
│          │  TEAM TABLE (6 rows) — clicking a row opens drawer ──►          │
└──────────┴─────────────────────────────────────────────────────────────────┘
```

Drawer slides in from the right and overlays the table; doesn't navigate away.

## Stat strip

A horizontal row of 4 KPI cards. Each: large number, label, micro chart or status dot.

For Khalid's team:
- **6 directs** — small avatar cluster
- **4 with active or pending IDPs** — bar showing 4/6 (warn if < team average)
- **1 awaiting your action** — red dot if > 0 ("evidence to validate")
- **2 on-track active IDPs** — green dot

Click any card to filter the table below.

## Action queue

A horizontal row of action cards (max 3 visible, more in overflow). Each card:

- Icon + verb ("Validate evidence", "Approve milestone reassign", "Coaching session not logged")
- Subject (who + what)
- Time since action requested
- Primary CTA

Examples for Khalid right now:
- 🟡 **Validate OJT evidence** — Mohammed Al-Mawali submitted "Co-led the maintenance shutdown"
  evidence 4 days ago. → Review.
- 🔴 **Coaching gap** — Salma hasn't logged a coaching session in 21 days. → Send reminder.
- 🟦 **Approve milestone reassign** — Layla wants to move her stretch milestone target from
  2026-12-10 to 2027-02-15. → Decide.

Empty state when nothing pending: "All clear — your team is moving along."

## Team table

One row per direct report, regardless of whether they have an IDP. Columns:

| Employee | Role / target role | IDP status | Milestones | % complete | Last activity | Quick action |
|----------|--------------------|------------|------------|-----------|----------------|--------------|

For Khalid (6 rows):

1. **Salma Al-Riyami** — Sr Ops Analyst → Ops Manager — `active` — 3 — 45% — 2 days ago — View
2. **Hamed Al-Kindi** — Ops Coordinator → Sr Ops Analyst — `pending_approval` — 4 — 0% — 6 days
   ago — Nudge L&D
3. **Noura Al-Wahaibi** — Field Ops Specialist — `draft` — 2 — 0% — 3 days ago (still drafting) —
   Send reminder
4. **Saif Al-Habsi** — Junior Ops Analyst → Ops Analyst — `pending_approval` — 2 — 0% — 9 days
   ago — Nudge L&D
5. **Layla Al-Busaidi** — Operations Trainee → Junior Ops Analyst — `pending_approval` — 4 — 0% —
   7 days ago — Nudge L&D
6. **Hessa Al-Toubi** — Logistics Coordinator — `completed` — 3 — 100% — 90 days ago — Start next
   IDP

Empty cell handling: if employee has no IDP, status cell shows "No IDP — Initiate" pill (linked).

Row hover state: subtle background tint, cursor pointer. Selected row stays highlighted while
drawer is open.

## Filter bar

Above the table:
- **Status** segmented control: All · Active · Pending · Draft · Completed · No IDP
- **Gap category** dropdown: knowledge / behavioural / technical (multi-select)
- **Competency** typeahead (filters team to those with the competency in their plan)
- **Sort** dropdown: Last activity · % progress · Name · Role

## Drawer (right slide-in)

Width 480px, opens when a row is clicked. Contents:

- Mini hero: avatar, name, role, status pill
- Progress bar
- Top 3 milestones with status dot + title (read-only)
- Action queue snippets: "2 actions assigned to you on this IDP"
- Footer: "Open full IDP" (primary), "Close" (ghost)

## Edge cases

- **No directs** (a freshly-promoted manager) — empty state with "Once your reports are assigned,
  you'll see them here."
- **Re-org churn** — if a direct moved onto Khalid's team mid-cycle and brought an active IDP from
  a previous manager, show a small "Inherited from Fatima Al-Lawati on 2026-04-01" tag on the
  row.
- **Coaching gap** signal source: `idp_actions.modality = 'coaching'` joined to coaching session
  logs — if `last_session_at + 21 days < today` and the action is not_started/in_progress.

## Data references

Tables: `employees` (manager_id = current user), `idps`, `idp_milestones`, `idp_actions`,
`ojt_assignments` (status = `evidence_submitted` for action queue), `audit_log` (last activity),
plus a derived "coaching_sessions" view (out of scope — for now treat as `idp_actions` with a
sessions relation).

Permissions: row-level security limits to `employees.manager_id = auth.uid()` plus tenant scope.

## Visual language

Same Shadcn baseline. Stat-strip numbers tabular. Action queue cards use the same warn / danger /
info palette as everywhere else. The table is dense (12px row padding) — this is a power-user
view.
