import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SignOutButton } from "@/components/auth/sign-out-button"
import { requireRole } from "@/lib/auth/require-role"

export default async function EmployeeHome() {
  const { user } = await requireRole(["employee"])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 p-4">
      <h1 className="text-3xl font-bold">Employee home placeholder</h1>
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
