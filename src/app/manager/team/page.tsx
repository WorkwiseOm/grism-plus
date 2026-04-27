import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requireRole } from "@/lib/auth/require-role"

export default async function ManagerTeamPlaceholder() {
  await requireRole(["manager", "coach"])

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        Team cockpit
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>Phase 1 placeholder</CardTitle>
          <CardDescription>
            The manager team cockpit lands here in Phase 1 slice 4.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-700">
          <p>
            Design contract:{" "}
            <code>design/stitch-phase1/manager_team_cockpit/</code>.
          </p>
          <p>
            Data shape: <code>getManagerTeamRollup()</code> from{" "}
            <code>src/lib/data</code>.
          </p>
          <p className="text-xs text-slate-500">
            Action queue, evidence validation, and direct-report drilldown
            are not implemented yet. Coach access remains tenant-wide via
            existing RLS — backlog item before pilot exposure.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
