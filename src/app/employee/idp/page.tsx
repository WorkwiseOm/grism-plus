import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requireRole } from "@/lib/auth/require-role"

export default async function EmployeeIdpPlaceholder() {
  await requireRole(["employee"])

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        IDP workspace
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>Phase 1 placeholder</CardTitle>
          <CardDescription>
            The employee IDP workspace lands here in Phase 1 slice 3.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-700">
          <p>
            Design contract:{" "}
            <code>design/stitch-phase1/employee_idp_workspace/</code>.
          </p>
          <p>
            Data shape: <code>getIdpDetail(idpId)</code> from{" "}
            <code>src/lib/data</code>.
          </p>
          <p className="text-xs text-slate-500">
            OJT evidence submission, milestone progress updates, and the
            70/20/10 blend panel are not implemented yet.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
