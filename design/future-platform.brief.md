# Stitch Brief - Future Platform Overview

## Goal

Create a production-ready platform overview wireframe for Grism Plus. This is not a marketing page. It is the logged-in operating surface for a multi-tenant talent development platform.

The design should help the team imagine the full product once Phase 1 and later hardening are complete:

- L&D admins manage competency frameworks, catalogues, approval queues, AI drafts, and governance.
- Managers track team IDPs, overdue actions, evidence, and approval decisions.
- Employees execute their IDP through eLearning, OJT, and coaching actions.
- Coaches support only assigned coachees after assignment-scoped RLS is implemented.

## Product Shape

Use a restrained SaaS operations interface:

- persistent left navigation
- compact top bar
- command-center dashboard
- dense status lists and tables
- clear role-specific drill-ins
- status pills for approval, risk, progress, and security gates
- no marketing hero section
- no decorative gradient backgrounds

## Main Screen

Design one desktop dashboard called "Production platform overview".

Top area:

- title: Production platform overview
- subtitle: One operating layer for competency gaps, IDPs, learning actions, OJT evidence, coaching, and L&D governance.
- status pills: Phase 0 foundation, Phase 1 build target, Wireframe only

Core product loop:

Show six connected stages:

1. Framework
2. Assessment
3. AI draft IDP
4. Approval
5. Execution
6. Evidence

Each stage should have a short label and a one-line hint.

Role map:

Show four role responsibilities:

- L&D admin: owns framework, approval queue, catalogues, audit posture.
- Manager: owns team execution, evidence review, unblock decisions.
- Employee: owns IDP progress, learning actions, OJT uploads.
- Coach: supports assigned coachees only after assignment-scoped RLS lands.

## Role Screen Tiles

Include four wireframe mini-screens:

1. L&D command center
   - KPIs: pending IDPs, competencies, coverage
   - list rows: review, AI, ready, audit

2. Manager team cockpit
   - KPIs: directs, blocked, average progress
   - progress rows with on-track, needs-help, evidence, late statuses

3. Employee IDP workspace
   - KPIs: milestones, actions, coach brief
   - rows for completed learning, OJT action, evidence upload, next action

4. Coach assigned-coachee view
   - mark as gated
   - KPIs: assigned coachees, briefs due, tenant-wide access = zero
   - rows for brief, session, risk, notes

## Build Lanes

Include three implementation lanes:

1. Phase 1: usable demo/pilot loop
   - IDP engine and approval queue
   - Employee IDP workspace
   - Manager team cockpit
   - Framework and catalogue management

2. Pre-pilot hardening
   - Vercel deploy path and branch protection
   - Client-IP trust verification
   - Coach assignment-scoped RLS or coach disabled
   - Smoke tests against deployed app

3. Production expansion
   - Notifications and recovery workflows
   - Customer-ready audit exports
   - External catalogue integrations
   - SOC 2 runbooks and vendor reviews

## Right Rail

Add a right rail with:

- pending gates checklist
- primary users list: Aisha, Khalid, Salma, Coach
- design rule note: keep the final product quiet, operational, dense, and predictable

## Visual Direction

Use the existing Grism Plus wireframe style:

- white and light gray surfaces
- compact typography
- Shadcn-like radius and borders
- blue for information
- green for success
- amber for review/risk
- red only for late or blocked work

Avoid:

- large decorative illustrations
- marketing copy
- nested card-heavy layouts
- oversized hero text
- fictional vendor names or pricing
