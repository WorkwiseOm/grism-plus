# Stitch Phase 1 Design Snapshot

Status: reviewed design reference, not production code

Source package: `C:/Users/tariq/Downloads/stitch (6).zip`

Captured: 2026-04-27

## Purpose

This folder preserves the Google Stitch export for the first Phase 1 product screens. It is the design snapshot that product, engineering, and Grism can point to while the real Next.js screens are implemented.

The files in this folder are not imported by the application and must not be copied wholesale into `src/`.

## Included Screens

| Folder | Screen | Phase 1 role | Implementation target |
| --- | --- | --- | --- |
| `l_d_admin_idp_approval_queue/` | IDP Approval Queue | L&D admin | `/admin/idps` and `/admin/idps/[id]` |
| `employee_idp_workspace/` | Employee IDP Workspace | Employee | `/employee/idp` and `/employee/idps/[id]` |
| `manager_team_cockpit/` | Manager Team Cockpit | Manager | `/manager/team` and `/manager/team/[employeeId]` |
| `framework_editor/` | Framework Editor | L&D admin | `/admin/frameworks` and `/admin/frameworks/[frameworkId]` |

Each screen folder contains:

- `screen.png` - visual reference.
- `code.html` - static Stitch export for layout inspection only.

## Implementation Rules

- Use these exports as a screen contract, not as app code.
- Rebuild the screens with the repo's Next.js App Router, Shadcn/UI, Tailwind configuration, route guards, server data loaders, and Supabase RLS posture.
- Do not rely on Tailwind CDN, Google-hosted font links, Material Symbols CDN, Alpine.js, or mock user data from the generated HTML.
- Replace all sample names, employee IDs, task IDs, and metrics with seeded/demo data loaders or real tenant data.
- Preserve the product intent: light, dense enterprise SaaS screens that operationalize 70/20/10 development, outcome-bearing OJT evidence, manager validation, and multi-signal skill progression.
- If a Google Stitch MCP or `.pen` export becomes available later, add it beside this snapshot. Do not remove this snapshot unless a newer reviewed snapshot replaces it.

## Review Notes

This snapshot aligns with the Grism Phase 1 feedback captured in `docs/GRISM_PHASE1_SCOPE_ALIGNMENT.md`:

- 70% experience, 20% relationships, 10% formal learning is visible in IDP surfaces.
- OJT is represented as an evidence-bearing workflow with manager validation.
- Skill progression is treated as a multi-signal operational workflow rather than a single completion percentage.
