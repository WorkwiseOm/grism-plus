import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requireRole } from "@/lib/auth/require-role"

export default async function CoachHome(): Promise<JSX.Element> {
  await requireRole(["coach"])

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        Coach workspace
      </p>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        Coach access pending
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>Assignment scoping required</CardTitle>
          <CardDescription>
            Coach access is held until assigned-coachee permissions are in
            place.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <p>
            This keeps pilot data access narrow while the dedicated coach
            assignment model is still open. Manager and L&amp;D workspaces remain
            available only to their own roles.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
