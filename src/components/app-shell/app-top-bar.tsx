import { SignOutButton } from "@/components/auth/sign-out-button"

type AppTopBarProps = {
  /**
   * Display name to show in the top bar's user slot. Falls back to email
   * if name is null. The shell decides what to pass; this component is
   * presentational only.
   */
  displayName: string
  /** Optional secondary line under the name (e.g., role title). */
  subtitle?: string | null
}

/**
 * Top bar — restrained product chrome. Tilqai × Grism brand on the left,
 * user identity + sign-out on the right. Tenant identity lives here once
 * the multi-tenant tenant-switcher arrives; for now it's a single-tenant
 * label.
 */
export function AppTopBar({
  displayName,
  subtitle,
}: AppTopBarProps): JSX.Element {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold tracking-tight text-slate-900">
          Grism Plus
        </span>
        <span className="hidden text-xs text-slate-400 sm:inline">
          Tilqai × Grism
        </span>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-slate-900">{displayName}</p>
          {subtitle ? (
            <p className="text-xs text-slate-500">{subtitle}</p>
          ) : null}
        </div>
        <SignOutButton />
      </div>
    </header>
  )
}
