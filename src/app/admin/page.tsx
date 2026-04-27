import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requireRole } from "@/lib/auth/require-role"

export default async function AdminHome() {
  await requireRole(["ld_admin", "superadmin"])

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        L&amp;D admin
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>Welcome</CardTitle>
          <CardDescription>
            Use the sidebar to open the approval queue or framework editor.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-slate-700">
          <p>
            Real product surfaces land in Phase 1 against the Stitch design
            contracts in <code>design/stitch-phase1/</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
