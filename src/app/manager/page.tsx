import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requireRole } from "@/lib/auth/require-role"

export default async function ManagerHome() {
  // Coach uses the manager landing for slice 1; splitting into a
  // dedicated /coach route is tracked as a Phase 1 scope decision.
  await requireRole(["manager", "coach"])

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        Manager
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>Welcome</CardTitle>
          <CardDescription>
            Use the sidebar to open the team cockpit.
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
