# Grism Phase 1 Scope Alignment

Status: captured for Phase 1 planning

Last updated: 2026-04-26

Source reviewed: `C:/Users/tariq/Downloads/TDEP_Phase1_Scope_Alignment.html`.

This document summarizes Grism's feedback for Tilqai review. It is product-scope input only; it does not authorize deployment, cloud migration, key creation, or other external operations.

## Phase 1 Must-Haves

1. **70/20/10 blend logic in IDP generation**

   IDP generation must default to the recognizable 70/20/10 development model:

   - 70% experience: OJT, stretch assignments, field rotations, workplace practice.
   - 20% relationships: coaching, mentoring, peer/buddy learning.
   - 10% formal: eLearning, classroom, workshops.

   The blend may be adjustable per skill type, but the default commercial promise is experience-led development. Generated plans and approval screens should expose the blend so an L&D admin can catch eLearning-heavy plans before approval.

2. **Multi-signal skill progression model**

   Phase 1 should capture skill-level progression signals from:

   - assessment results
   - OJT manager feedback
   - coaching feedback
   - eLearning completion

   A competency level should not advance from one source alone. The progression rule needs weights and a convergence guard.

3. **OJT task and evidence capture**

   OJT must be an outcome-bearing task tied to a competency, not just a duration tag. The minimum Phase 1 loop is:

   - define OJT task
   - assign it against an IDP milestone
   - employee submits evidence
   - manager validates and gives feedback
   - validation contributes a skill-progression signal

## Phase 2 Backlog

These are acceptable to defer unless a pilot contract explicitly pulls them forward:

- ILT pre/post-work automation.
- 30/60/90-day workshop reinforcement.
- Peer learning circles.
- Succession pipeline view.
- Social learning.
- Coach-side session log linked to IDP milestones.

Manager-side AI coaching brief remains Phase 1 scope.

## Demo Data Watch Item

Before showing the wireframes to prospective tenants, revise any summary that implies an inverted 70/20/10 mix such as 70% eLearning / 20% OJT / 10% coaching.

The intended display should be closer to:

- 70% experience
- 20% relationships
- 10% formal learning

This is especially important for Layla's sample IDP because HR leaders in Oman will recognize the 70/20/10 model quickly.

## Project Updates Made

- `docs/PHASE_1_PLAN.md` now treats the three must-haves as Phase 1 scope.
- `docs/ojt-reference.md` now frames OJT as the 70% experience layer and a required skill-progression signal.
- `docs/module-library.md` now frames eLearning as the 10% formal layer, not the dominant default.
- `design/future-platform.html`, `design/idp-approval.html`, and `design/idp-view.html` now surface 70/20/10 blend expectations.
