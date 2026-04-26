# Stitch brief — IDP View

> Phase 1 · roles: `employee`, `manager`, `coach`, `ld_admin`
> Companion mockup: `idp-view.html` (Salma Al-Riyami, IDP #9, status `active`)

## What this screen is for

This is the anchor screen of the whole product — the page an employee opens to see their own
development plan in motion, and the page their manager / coach / L&D admin opens to look in on
them. The same canvas serves all four viewer roles; only the affordances change.

Salma is a Senior Ops Analyst on a "Step-up to Ops Manager" pathway. Her IDP has 3 milestones
(BIZ-STRAT, LEAD-COACH, BIZ-PM). It was approved 6 weeks ago by Aisha. Two actions are already
complete, three are in progress, two haven't started. She needs to see at a glance:

1. Where she is (% of actions done, days remaining, status).
2. What's next (the one or two things she should be working on this week).
3. Why this plan exists (narrative, gaps it addresses).
4. How to update the system as she makes progress (mark action done, attach OJT evidence, log a
   coaching session).

A manager opening the same screen needs Salma's progress + the ability to leave a note, view OJT
evidence, and reassign a milestone if the original action turns out to be unrealistic.

## Layout — single column, hero + sections

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Top app bar                                                                │
├──────────┬─────────────────────────────────────────────────────────────────┤
│ Sidebar  │  Page header: employee name + "← My team" if manager view       │
│          ├─────────────────────────────────────────────────────────────────┤
│          │  HERO CARD — progress, days, status, target role                │
│          ├─────────────────────────────────────────────────────────────────┤
│          │  "What's next" strip — top 2 actions surfaced                   │
│          ├─────────────────────────────────────────────────────────────────┤
│          │  Tabs: Milestones · Narrative · Activity · People               │
│          ├─────────────────────────────────────────────────────────────────┤
│          │  Tab body                                                       │
└──────────┴─────────────────────────────────────────────────────────────────┘
```

Right-rail is optional — for first cut, fold "People" (manager / coach contacts) into a tab so the
screen stays single-column on tablet too.

## Hero card

A single wide card. Left: large avatar, employee name, current → target role. Middle: three big
stats (% actions complete, days until target, status pill). Right: action cluster (Download PDF,
Edit IDP if owner, Add note if manager).

Worked example for Salma:
- Avatar (a2 gradient, "SR")
- "Salma Al-Riyami · ARW-006"
- "Senior Ops Analyst → Operations Manager"
- 5 of 11 actions done (45%)
- 218 days to target (2026-11-30)
- status: `active` (green pill), approved by Aisha 2026-03-12

A horizontal progress bar runs along the bottom of the hero, segmented by milestone so you can
see which milestone is dragging.

## "What's next" strip

A horizontal scroll of 2–3 chips, one per high-priority action that's not done. Each chip shows:

- Modality glyph (eLearning blue / OJT amber / Coaching purple)
- Action title (1 line, truncated)
- Due date (if set)
- Single-button affordance: "Mark done" (eLearning if cert uploaded), "Attach evidence" (OJT),
  "Log session" (Coaching).

This is the "what should I do this week" surface. If everything is done, show a muted celebratory
state ("All scheduled actions are done — see you next milestone").

## Milestones tab (default)

Vertical timeline of milestone cards. Each card:

- Left edge: vertical line + dot per milestone, dot color = status (gray not_started, blue
  in_progress, green completed)
- Header: competency code + name, gap chip (L2 → L4), milestone title (bold)
- Description (muted)
- Action checklist:
  - Modality glyph
  - Action title + catalogue source line
  - Status pill (`enrolled`, `completed`, `assigned`, `evidence_submitted`, `validated`)
  - Inline "Update" button — disclosure based on viewer role
- Footer row: target date · completed_at if done · reassign link (manager+)

Use card collapse: completed milestones collapse to a single line by default; in-progress and
not-started stay expanded.

## Narrative tab

Read-only render of `idps.narrative`. Two-column at wide widths: narrative on the left, "Why this
plan" assessment summary on the right (drove gaps · top 3 competencies · proficiency target).

If the IDP is `narrative_source = template`, show a small "Generated from template T-xxx" tag.

## Activity tab

Reverse-chronological audit feed scoped to this IDP only:

- "Approved by Aisha Al-Balushi · 2026-03-12"
- "Salma marked 'Coursera — Strategy for Operating Leaders' as completed · 2026-04-05"
- "Khalid (manager) added a note on 'BIZ-PM · Lead the FY27 budget exercise' · 2026-04-12"
- "Maryam (coach) logged a 30-min session · 2026-04-18"

Each row carries an avatar + actor + verb + object + relative time. Filter chips at top
(`approval`, `progress`, `notes`, `evidence`, `coaching`).

## People tab

Three small cards: Manager (Khalid), Coach (Maryam), L&D admin (Aisha). Each shows avatar, role,
last contact timestamp, "Send message" button (out of scope for Phase 1, but reserve the slot).

## Manager-mode add-ons

When viewer role is `manager` and they manage this employee:

- Hero card gains an "Add note" CTA in the action cluster.
- Milestone cards gain a "Reassign" link in the footer.
- Action rows gain a "View OJT evidence" button when modality = ojt and status ∈
  {`evidence_submitted`, `validated`}.
- A small banner above the hero: "You're viewing this as Salma's manager. She can see your
  notes." — keeps it transparent.

## Coach-mode add-ons

When viewer role is `coach`, restrict edit affordances to coaching actions only. The "Log session"
button on coaching action rows replaces the generic "Update". Other action types render
read-only.

## L&D admin add-ons

L&D admin sees everything plus a small "Admin" dropdown in the page header: "Revoke approval
(reverts to draft)", "Edit assessment", "Force complete" — destructive actions, all requiring
confirmation.

## Empty / loading / error states

- **Loading**: shimmer hero + 3 shimmer milestone cards.
- **Action update fails**: inline alert under the action row + toast.
- **No active IDP** (employee landing): redirect to a "You don't have an active IDP" landing with
  CTAs to (a) start a draft, (b) browse templates.

## Edge cases

- **Mid-cycle role change** — if `employee.role_title` changed since IDP was approved, show a
  warn banner: "Salma's role changed to Operations Manager on 2026-04-01. This IDP was authored
  for her previous role (Senior Ops Analyst)."
- **Catalogue churn** — if a referenced eLearning course is deprecated, show "Course retired —
  swap" link in red.
- **Past target** — if `target_completion_date < today` and status still `active`, hero stat
  flips to "Overdue by N days" (red).
- **Coaching gap** — if a coaching action has no logged sessions in 21 days, show an amber
  reminder.

## Data references

Tables: `idps`, `idp_milestones`, `idp_actions`, `competencies`, `competency_scores`,
`elearning_enrolments`, `ojt_assignments`, `assessments`, `audit_log` (read for activity feed).

## Visual language

Same Shadcn baseline. Big numbers in the hero card use a `font-variant-numeric: tabular-nums`
treatment so they line up. Avatar gradients per-employee deterministic (already in
`_shared.css`). Modality colours stay constant across the product.
