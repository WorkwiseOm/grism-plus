# Stitch brief — IDP Approval Queue

> Phase 1 · role: `ld_admin` · primary persona: Aisha Al-Balushi
> Companion mockup: `idp-approval.html`

## What this screen is for

Aisha is the L&D Manager at Arwa Energy. Right now there are 8 IDPs sitting in `pending_approval`
waiting on her sign-off. She needs to triage them, read each one's narrative + milestone plan +
catalogued actions, and either **approve** (status → `active`), **request changes** (status stays
`pending_approval`, comment routed to author), or **reject** (status → `draft`, comment routed to
author).

A reviewed IDP must surface enough context that Aisha doesn't have to bounce out:
- Who the employee is, what role they hold, what role they're targeting.
- Why this IDP exists (assessment that drove it, narrative, source: manual vs template).
- Which competencies are in play, current vs target proficiency, gap score.
- What milestones and actions the author proposed, mapped to the eLearning / OJT / coaching
  catalogues where applicable.

## Layout — two-pane

Outer shell: top app bar (Grism+ wordmark, breadcrumb, user avatar) + left primary nav (Home,
IDPs, People, Catalogues, Framework, Reports, Settings). Main canvas split horizontally:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Top app bar                                                                │
├──────────┬──────────────────────────────────────────────────────────────────┤
│          │  Page header: "Approval queue"  · subtitle counts                │
│   Side   ├──────────────────────────────────────────────────────────────────┤
│   nav    │  [ Status filter chips ] [ Search ] [ Sort ]                     │
│          ├───────────────────┬──────────────────────────────────────────────┤
│          │  QUEUE LIST       │  REVIEW PANE                                 │
│          │  (8 rows)         │                                              │
│          │  scrollable       │  Employee header                             │
│          │                   │  Narrative + assessment                      │
│          │                   │  Milestones (collapsible cards)              │
│          │                   │  ── Action footer (Approve / Changes / Reject)│
└──────────┴───────────────────┴──────────────────────────────────────────────┘
```

Suggested column ratio for the inner split: 360px queue / fluid review pane.

## Queue list — what each row shows

One row per pending IDP. Sorted oldest-submitted first by default.

- **Avatar** (employee initials, gradient background)
- **Employee name** (1 line) + **role title → target role title** (1 line, smaller, muted)
- **Department** chip (Operations / Engineering / Commercial)
- **Submitted** relative timestamp ("3d ago")
- **Source** badge: `manual` (employee-initiated) or `template` (L&D-initiated)
- **Milestone count** (e.g. "4 milestones")
- **Gap severity** dot — derived from highest gap_score across milestones (red ≥ 3 levels, amber 2,
  blue 1)

Selected row gets a left accent border in `--info` and a slightly tinted background.

## Review pane — top section: employee header

Card with:
- xl avatar
- Name, employee number (e.g. "Layla Al-Busaidi · ARW-010")
- Role title in bold, target role title beneath in muted: "Operations Trainee → Junior Ops Analyst"
- Manager name (linked) and department
- Hire date and tenure (auto-computed)
- Pill row: status (`pending_approval`), source (`manual` | `template`), submitted-at timestamp

## Review pane — narrative + assessment

Two stacked cards:
1. **Narrative** — long-form text the author wrote (or AI generated, see metadata note).
2. **Assessment** — small key-value grid with `source_platform` ("Manual demo seed" for now),
   conducted_at, summary count (X competencies scored, Y identified as gap). Expandable accordion
   with `raw_data` for power users (collapsed by default).

If `narrative_source = "template"`, show a small inline tag: "Generated from Arwa starter
template (T-OPS-1)".

## Review pane — milestones

A vertical stack of milestone cards, one per `idp_milestones` row. Each card:

- **Header row:**
  - Competency category color stripe (left edge, 4px)
  - Competency code + name ("ANAL-RCA · Root Cause Analysis")
  - Gap score chip: shows `current_proficiency → target_proficiency` (e.g. "L2 → L4" with a small
    bar visualizing the delta)
- **Body:**
  - Milestone title (bold, 14px)
  - Description (muted, 13px)
  - Target date with calendar glyph
- **Actions list** (sub-list within the card):
  - Modality icon (eLearning blue / OJT amber / Coaching purple)
  - Action title — for elearning/ojt this resolves to a catalogue entry (e.g. "Lean Root Cause
    Analysis Bootcamp" pulled from `elearning_catalogue` via `external_ref_id`); for coaching
    it's free text (e.g. "Pair with Senior Eng on next plant trip RCA")
  - Catalogue link icon (only on elearning/ojt actions) — opens catalogue entry in side drawer

If the IDP has 0 actions on a milestone, show a soft warn callout: "No actions specified on
this milestone — author may have forgotten to attach activities."

## Review pane — sticky footer (action bar)

Always-visible footer inside the review pane:

- **Approve** (primary, dark) — fires confirm modal: "Approve IDP for Layla Al-Busaidi? She'll be
  notified by email and the IDP becomes Active immediately."
- **Request changes** (warn outline) — opens comment composer; submission keeps status
  `pending_approval`, sends comment to author.
- **Reject** (destructive ghost) — opens comment composer; submission flips status to `draft`,
  sends comment to author. Confirms once.
- Left side: small "Last reviewed by ..." line if this IDP has been bounced before.

## Empty / loading / error states

- **Empty queue**: "Nothing waiting — you're caught up." Big check glyph, link to "View active
  IDPs" and "View completed IDPs".
- **No row selected** (right pane): "Select an IDP from the queue to start reviewing." Subtle.
- **Action error**: inline alert above the action footer ("Couldn't approve — try again"), plus
  toast.
- **Loading**: skeleton rows in the queue, skeleton blocks in the review pane.

## Edge cases worth designing for

- **IDP author no longer employed** — show a destructive banner above the employee header:
  "This employee has been deactivated. Approval will route to their replacement (none assigned)."
- **Catalogue link broken** — if `external_ref_id` doesn't resolve, show inline "Catalogue
  entry deleted" tag in red instead of the title.
- **Gap score regressed** since IDP was authored — show a small "Gap score has changed since this
  IDP was submitted (was L2→L4, now L3→L4)" amber note on the milestone.
- **AI-assisted IDP** — `ai_generation_metadata` non-null: show small "AI-assisted" pill on the
  employee header with hover-tooltip listing model + timestamp.

## Data references

Tables touched: `idps`, `idp_milestones`, `idp_actions`, `competencies`, `competency_scores`,
`assessments`, `elearning_catalogue`, `ojt_catalogue`, `employees`, `tenants` (RLS scope),
`audit_log` (write).

The "Approve" action writes:
- `idps.status = 'active'`
- `idps.approved_by = auth.uid()`
- `idps.approved_at = now()`
- audit log row via existing trigger (no app-side write needed).

## Visual language

- Match the Shadcn baseline already wired up: navy primary, slate neutrals, 12px radius, soft
  border + shadow. No glass / no gradients on chrome.
- One accent each for the modality glyphs (blue / amber / purple) — used consistently across the
  product.
- Avatar gradients are decorative only; keep them per-employee deterministic.
