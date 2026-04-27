import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requireRole } from "@/lib/auth/require-role"

export default async function AdminFrameworksPlaceholder() {
  await requireRole(["ld_admin", "superadmin"])

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        Framework editor
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>Phase 1 placeholder</CardTitle>
          <CardDescription>
            The competency framework editor lands here in Phase 1 slice 5.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-700">
          <p>
            Design contract:{" "}
            <code>design/stitch-phase1/framework_editor/</code> plus the brief
            in <code>design/framework-editor.brief.md</code>.
          </p>
          <p>
            Data shape: <code>getFrameworkTree()</code> from{" "}
            <code>src/lib/data</code>.
          </p>
          <p className="text-xs text-slate-500">
            Edit / publish / draft-version flows are not implemented yet; see
            the open-decisions list in <code>docs/PHASE_1_PLAN.md</code> slice
            5.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
