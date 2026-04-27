import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getCurrentEmployeeContext } from "@/lib/data/current-employee"
import { AppSidebar } from "./app-sidebar"
import { AppTopBar } from "./app-top-bar"
import { getNavItemsForRole } from "./nav-config"

type AppShellProps = {
  children: React.ReactNode
}

/**
 * Authenticated product shell. Server component.
 *
 * Calls getCurrentEmployeeContext() to resolve the user/profile/employee
 * context that drives the top-bar identity and the role-aware sidebar.
 *
 * Defence-in-depth contract: the route guard (requireRole at the page
 * level) is the source of truth for "who may see this surface." The
 * shell does not redirect on bad role; it only renders. If the loader
 * returns failure reasons (not_authenticated / profile_not_found), the
 * shell renders a clear empty/error state — but those branches are
 * effectively dead code under the existing requireRole flow because
 * requireRole would have redirected already.
 */
export async function AppShell({ children }: AppShellProps): Promise<JSX.Element> {
  const result = await getCurrentEmployeeContext()

  if (!result.ok) {
    return <ShellErrorState reason={result.reason} detail={result.detail} />
  }

  const { profile, employee } = result.data
  const sections = getNavItemsForRole(profile.role)
  const displayName = profile.full_name?.trim() || profile.email || "Account"
  const subtitle = employee?.role_title ?? null

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <AppTopBar displayName={displayName} subtitle={subtitle} />
      <div className="flex flex-1">
        <AppSidebar sections={sections} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}

type ErrorReason =
  | "not_authenticated"
  | "profile_not_found"
  | "employee_not_found"
  | "not_found"
  | "query_error"

function ShellErrorState({
  reason,
  detail,
}: {
  reason: ErrorReason
  detail?: string
}): JSX.Element {
  const message = errorMessageFor(reason)
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Cannot load your account context</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-700">
          <p>{message}</p>
          {detail ? (
            <p className="text-xs text-slate-500">Detail: {detail}</p>
          ) : null}
          <p className="text-xs text-slate-500">
            If this persists, contact your tenant administrator.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function errorMessageFor(reason: ErrorReason): string {
  switch (reason) {
    case "not_authenticated":
      return "You appear to be signed out. Reload the page to sign back in."
    case "profile_not_found":
      return "We could not find a user profile linked to your account."
    case "employee_not_found":
      return "Your profile is missing an employee record for this tenant."
    case "not_found":
      return "The requested record could not be found."
    case "query_error":
      return "An unexpected error occurred while loading your account context."
    default:
      return "An unexpected error occurred."
  }
}
