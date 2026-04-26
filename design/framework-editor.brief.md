# Stitch brief — Framework Editor

> Phase 1 · role: `ld_admin` · primary persona: Aisha Al-Balushi
> Companion mockup: `framework-editor.html`

## What this screen is for

Aisha owns the **Arwa Energy Core Competency Framework v1**. She needs to add new competencies,
edit definitions, refine the proficiency-level descriptors, recategorise leaves under different
parents, deprecate things that no longer apply, and publish a new version when she wants the
changes to take effect. The current framework is 5 parent categories (TECH, LEAD, COMM, ANAL, BIZ)
with 20 leaf competencies. Each competency has 5 proficiency levels (Awareness → Expert) with a
`gap_category` enum (knowledge / behavioural / technical) used downstream by the AI recommender.

This is a back-office screen — power-user density, no hand-holding chrome, but it must be safe:
edits to a published framework affect every IDP in flight, so destructive changes need
guardrails.

## Layout — three pane

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Top app bar                                                                │
├──────────┬─────────────────────────────────────────────────────────────────┤
│ Sidebar  │  Page header: framework name + version badge + Publish button   │
│          ├──────────────────┬────────────────────────┬─────────────────────┤
│          │  TREE PANEL      │  EDIT PANEL            │  COVERAGE / META    │
│          │  5 categories    │  Form for the          │  Where this is used │
│          │  20 leaves       │  selected node         │  Version history    │
│          │  drag handles    │                        │                     │
│          │  + Add buttons   │                        │                     │
└──────────┴──────────────────┴────────────────────────┴─────────────────────┘
```

Suggested split: 280px tree / fluid edit / 280px coverage. Coverage panel collapses to a tab on
narrow viewports.

## Page header

- Framework name with inline edit affordance
- Version badge: `v1 · published 2026-01-30` (click to open version history dropdown)
- Status pill: `published` (green) or `draft v2` (amber, when unpublished edits exist)
- Buttons: **Save changes** (saves to draft v2), **Publish v2** (primary, opens confirm modal),
  **Discard draft** (ghost, only when draft exists)

## Tree panel (left)

- Header row: "Framework structure" + "+ Add category" button
- Each category row:
  - Drag handle (◇), expand chevron, category code + name, leaf count chip
  - Hover affordances: "+ Add competency", "Rename", "•••" menu (Move, Deprecate, Delete)
- Each leaf row (indented):
  - Drag handle, leaf code + name, gap_category dot
  - Selected state: filled background, primary text colour
- Reordering inside a category by drag; reparenting by dragging onto another category
- Bottom: "+ Add category" button repeated for ergonomics

For Arwa, the tree is:

```
TECH · Technical (4)
  TECH-IND   Industrial Safety Fundamentals
  TECH-DATA  Data Tooling Foundations
  TECH-WRIT  Technical Writing
  TECH-TOOL  Engineering Tooling
LEAD · Leadership (4)
  LEAD-COACH Coaching & Developing Others
  LEAD-PERF  Performance Conversations
  LEAD-MOTV  Motivating Teams
  LEAD-CONF  Confident Decision-Making
COMM · Communication (4)
  COMM-PRES  Operational Presentation Skills
  COMM-WRIT  Written Communication
  COMM-XFN   Cross-Functional Communication
  COMM-EXT   External Stakeholder Communication
ANAL · Analytical (4)
  ANAL-RCA   Root Cause Analysis
  ANAL-CRIT  Critical Thinking
  ANAL-PROC  Process Optimisation
  ANAL-DEC   Data-Driven Decision-Making
BIZ · Business (4)
  BIZ-PM     Project Management
  BIZ-RISK   Risk Management
  BIZ-FIN    Financial Literacy
  BIZ-STRAT  Strategic Thinking
```

## Edit panel (centre)

When a leaf is selected, render an edit form:

- **Competency code** (read-only after creation; surfaced for visibility)
- **Name** (required)
- **Description** (textarea, markdown allowed)
- **Parent category** (select)
- **Gap category** (segmented: knowledge / behavioural / technical)
- **Proficiency scale (5 levels)** — stack of 5 inline editable rows, each:
  - Level number + canonical label (Awareness / Working / Practising / Advanced / Expert) — fixed
  - Level descriptor (textarea, what "looks like" at this level)
  - "Reset to template" link if descriptor was edited away from the framework default
- **Behavioural anchors** (optional list of 3–5 short statements)
- **Tags** (free-form, used by the AI recommender)
- **Status**: `active` | `draft` | `deprecated` (deprecated competencies stay queryable for
  historical IDPs but don't appear in new IDP authoring)

Form footer: **Save**, **Discard changes**.

When a category is selected, the centre panel shows:
- Category name + description
- Reorderable list of children with leaf counts and gap_category dots
- "+ Add competency to this category" CTA

When nothing is selected, show an empty state inviting the user to pick a competency from the
tree.

## Coverage panel (right)

Tells Aisha "if I change this, what breaks?" — a make-or-break safety surface for editing a live
framework.

When a leaf is selected, show:

- **Coverage stats**:
  - "12 employees scored on this competency" → click opens drill-down
  - "5 IDPs reference this competency" → list with links
  - "3 catalogue entries tagged with this competency" (eLearning + OJT)
- **Change preview** (when there are unsaved edits):
  - Yellow callout: "You changed the L4 descriptor. 3 active IDPs reference this competency at
    L4 target — they will see the new descriptor on their next refresh."
  - Red callout for breaking changes: "Marking this competency `deprecated` will hide it from the
    authoring UI. 5 in-flight IDPs will keep the old reference."
- **Version history**:
  - v1 published 2026-01-30 by Aisha — initial release
  - v2 draft (12 unsaved changes) — current
- **Audit trail** for this competency (last 5 entries from `audit_log`)

When a category is selected, coverage shows aggregate stats across its children.

## Publish flow

"Publish v2" button → modal:
- Diff summary: "v2 vs v1 — 4 new competencies, 7 descriptors edited, 1 leaf moved to a new
  parent, 0 deprecations"
- Impact: "23 active or pending IDPs touch competencies in this version. They will be migrated
  automatically (no data loss)."
- Confirm input: type `PUBLISH` to confirm
- Action buttons: **Cancel**, **Publish v2** (destructive primary)

After publish: previous version snapshotted (immutable), new version becomes current.

## Empty / loading / error states

- **No framework yet** (fresh tenant): empty state with "Start from a template" (Generic /
  Engineering / Operations) and "Start blank" CTAs.
- **Save error**: inline alert above the form footer + toast.
- **Concurrent edit conflict**: modal "This competency was edited by Yusuf 2 minutes ago — review
  before saving" with a side-by-side diff.
- **Loading**: tree skeleton + form skeleton.

## Edge cases

- **Cycle in parent assignment** — UI must prevent dragging a category onto its own descendant;
  drop zones disabled.
- **Code collision** — codes (e.g. `TECH-IND`) are unique within framework version; on rename
  attempt, validate inline.
- **Catalogue tag drift** — if a competency is renamed, catalogue entries show "needs review" tag
  but are not auto-edited.
- **Deprecation with active IDPs** — allowed, but coverage panel makes the consequence visible.

## Data references

Tables: `competency_frameworks` (versioned), `competencies`, `competency_proficiency_levels`,
`competency_behavioural_anchors` (or jsonb on competencies — TBD), `idps`, `idp_milestones`,
`competency_scores`, `elearning_catalogue`, `ojt_catalogue`, `audit_log`.

Permissions: `ld_admin` only. Edit operations write to draft version; publish requires explicit
confirmation.

## Visual language

Power-user density — 12px row padding in the tree, compact form spacing, monospace for codes
(`TECH-IND`). Coverage panel uses the same warn / danger / info palette so unsafe edits visually
escalate. Drag handles use the standard `drag_indicator` icon affordance from the rest of the
product (matches the bayt-al-khibra pattern).
