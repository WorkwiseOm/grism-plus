import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requireRole } from "@/lib/auth/require-role"

export default async function AdminIdpsPlaceholder() {
  await requireRole(["ld_admin", "superadmin"])

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        Approval queue
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>Phase 1 placeholder</CardTitle>
          <CardDescription>
            The IDP approval queue lands here in Phase 1 slice 2.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-700">
          <p>
            Design contract:{" "}
            <code>design/stitch-phase1/l_d_admin_idp_approval_queue/</code>.
          </p>
          <p>
            Data shape: <code>getIdpSummaryList()</code> +
            <code> groupIdpSummariesByStatus()</code> from{" "}
            <code>src/lib/data</code>.
          </p>
          <p className="text-xs text-slate-500">
            Approve / return / edit actions are not implemented yet.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
