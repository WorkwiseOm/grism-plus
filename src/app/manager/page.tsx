import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SignOutButton } from "@/components/auth/sign-out-button"
import { requireRole } from "@/lib/auth/require-role"

export default async function ManagerHome() {
  // Coach uses the manager landing for slice 1; splitting into a
  // dedicated /coach route is tracked as a Phase 1 scope decision.
  const { user } = await requireRole(["manager", "coach"])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 p-4">
      <h1 className="text-3xl font-bold">Manager home placeholder</h1>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Signed in</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <span className="text-sm text-slate-700">{user.email}</span>
          <SignOutButton />
        </CardContent>
      </Card>
    </div>
  )
}
