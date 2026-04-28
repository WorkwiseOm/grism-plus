import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { requireRole } from "@/lib/auth/require-role"
import { getManagerOjtEvidenceQueue, getManagerTeamRollup } from "@/lib/data"
import type {
  LoaderFailureReason,
  LoaderResult,
  OjtEvidenceQueueItem,
  TeamMemberRollup,
} from "@/lib/data"
import {
  buildManagerCockpitStats,
  deriveMemberStatus,
  formatDate,
  selectTeamMember,
  statusLabel,
} from "@/lib/manager-cockpit/rollup"
import { cn } from "@/lib/utils"
import { validateOjtEvidenceAction } from "./actions"

type PageProps = {
  searchParams?: Promise<{ employee?: string | string[] }>
}

export default async function ManagerTeamPage({
  searchParams,
}: PageProps): Promise<JSX.Element> {
  await requireRole(["manager"])
  const params = await searchParams
  const requestedEmployeeId = Array.isArray(params?.employee)
    ? params?.employee[0]
    : params?.employee

  const rollup = await getManagerTeamRollup()
  if (!rollup.ok) {
    return <CockpitErrorState reason={rollup.reason} detail={rollup.detail} />
  }

  const evidenceQueue = await getManagerOjtEvidenceQueue()
  const stats = buildManagerCockpitStats(rollup.data)
  const selected = selectTeamMember(rollup.data, requestedEmployeeId)
  const evidenceCount = evidenceQueue.ok ? evidenceQueue.data.length : 0

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Manager workspace
        </p>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              Team cockpit
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Monitor direct-report IDP execution and spot plans that need
              follow-up. Evidence validation writes through audited server-side
              controls and feeds skill progression.
            </p>
          </div>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-6">
        <MetricCard label="Direct reports" value={stats.reports} />
        <MetricCard label="Active IDPs" value={stats.activeIdps} tone="green" />
        <MetricCard
          label="Needs review"
          value={stats.pendingApproval}
          tone="amber"
        />
        <MetricCard label="Stalled" value={stats.stalledIdps} tone="red" />
        <MetricCard label="No IDP" value={stats.reportsWithoutIdps} />
        <MetricCard label="OJT evidence" value={evidenceCount} tone="blue" />
      </section>

      <EvidenceQueuePanel result={evidenceQueue} />

      {rollup.data.length === 0 ? (
        <EmptyTeamState />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.3fr)]">
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-slate-200">
              <CardTitle className="text-base">Team rollup</CardTitle>
              <CardDescription>
                Direct reports only. RLS remains the boundary.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <TeamList rows={rollup.data} selectedId={selected?.employee.id ?? null} />
            </CardContent>
          </Card>

          <Card>
            {selected ? <SelectedTeamMember row={selected} /> : <EmptyTeamState />}
          </Card>
        </div>
      )}
    </div>
  )
}

function TeamList({
  rows,
  selectedId,
}: {
  rows: TeamMemberRollup[]
  selectedId: string | null
}): JSX.Element {
  return (
    <div className="divide-y divide-slate-200">
      {rows.map((row) => {
        const active = row.employee.id === selectedId
        const status = deriveMemberStatus(row)
        return (
          <Link
            key={row.employee.id}
            href={`/manager/team?employee=${row.employee.id}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "block p-4 transition-colors",
              active ? "bg-slate-900 text-white" : "hover:bg-slate-50",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {row.employee.full_name}
                </p>
                <p
                  className={cn(
                    "mt-1 text-xs",
                    active ? "text-slate-300" : "text-slate-500",
                  )}
                >
                  {row.employee.role_title}
                  {row.employee.department ? ` · ${row.employee.department}` : ""}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-1 text-xs font-medium",
                  active ? "bg-white/15 text-white" : statusToneClass(status.tone),
                )}
              >
                {status.label}
              </span>
            </div>
            <div
              className={cn(
                "mt-3 flex flex-wrap gap-2 text-xs",
                active ? "text-slate-300" : "text-slate-500",
              )}
            >
              <span>{row.total_idps} IDP{row.total_idps === 1 ? "" : "s"}</span>
              <span>{row.idp_counts.active} active</span>
              <span>{row.idp_counts.pending_approval} pending</span>
              <span>{row.idp_counts.stalled} stalled</span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function SelectedTeamMember({ row }: { row: TeamMemberRollup }): JSX.Element {
  const status = deriveMemberStatus(row)
  const recent = row.most_recent_idp

  return (
    <>
      <CardHeader className="border-b border-slate-200">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-xl">{row.employee.full_name}</CardTitle>
            <CardDescription className="mt-1">
              {row.employee.role_title}
              {row.employee.target_role_title
                ? ` -> ${row.employee.target_role_title}`
                : ""}
            </CardDescription>
          </div>
          <span
            className={cn(
              "w-fit rounded-full px-2.5 py-1 text-xs font-medium",
              statusToneClass(status.tone),
            )}
          >
            {status.label}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-5">
        <section className="grid gap-3 sm:grid-cols-3">
          <DetailFact label="Total IDPs" value={row.total_idps} />
          <DetailFact label="Active" value={row.idp_counts.active} />
          <DetailFact label="Stalled" value={row.idp_counts.stalled} />
        </section>

        <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-sm font-semibold text-slate-950">Most recent IDP</h2>
          {recent ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <DetailFact label="Status" value={statusLabel(recent.status)} />
              <DetailFact
                label="Target"
                value={formatDate(recent.target_completion_date)}
              />
              <DetailFact
                label="Last activity"
                value={formatDate(recent.last_activity_at)}
              />
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-600">
              This direct report has no visible IDPs yet.
            </p>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-950">IDP status mix</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {Object.entries(row.idp_counts).map(([statusKey, count]) => (
              <div
                key={statusKey}
                className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2"
              >
                <span className="text-sm text-slate-600">
                  {statusLabel(statusKey as keyof typeof row.idp_counts)}
                </span>
                <span className="text-sm font-semibold text-slate-950">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-dashed border-slate-300 p-4">
          <h2 className="text-sm font-semibold text-slate-950">
            Evidence validation
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            This panel is reserved for OJT evidence review and manager feedback.
            It will be wired once audited write flows and progression signals
            are ready.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button disabled>Certify validation</Button>
            <Button variant="outline" disabled>
              Request changes
            </Button>
          </div>
        </section>
      </CardContent>
    </>
  )
}

function EvidenceQueuePanel({
  result,
}: {
  result: LoaderResult<OjtEvidenceQueueItem[]>
}): JSX.Element {
  return (
    <Card>
      <CardHeader className="border-b border-slate-200">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-base">OJT evidence queue</CardTitle>
            <CardDescription>
              Submitted direct-report evidence waiting for manager validation.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {!result.ok ? (
          <p className="p-4 text-sm text-slate-600">
            OJT evidence could not be loaded.
          </p>
        ) : result.data.length === 0 ? (
          <p className="p-4 text-sm text-slate-600">
            No submitted OJT evidence is waiting for validation.
          </p>
        ) : (
          <div className="divide-y divide-slate-200">
            {result.data.slice(0, 5).map((item) => (
              <div key={item.evidence.id} className="p-4">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      {item.employee.full_name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.catalogue?.title ?? "OJT assignment"} · submitted{" "}
                      {formatDate(item.evidence.submitted_at)}
                    </p>
                  </div>
                  <span className="w-fit rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                    Evidence submitted
                  </span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-slate-700">
                  {item.evidence.self_reflection}
                </p>
                <form
                  action={validateOjtEvidenceAction}
                  className="mt-3 space-y-2"
                >
                  <input type="hidden" name="evidenceId" value={item.evidence.id} />
                  <textarea
                    name="notes"
                    minLength={5}
                    required
                    rows={2}
                    placeholder="Add concise validation notes for the employee record."
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="submit"
                      name="status"
                      value="approved"
                      size="sm"
                    >
                      Certify validation
                    </Button>
                    <Button
                      type="submit"
                      name="status"
                      value="changes_requested"
                      size="sm"
                      variant="outline"
                    >
                      Request changes
                    </Button>
                    <Button
                      type="submit"
                      name="status"
                      value="rejected"
                      size="sm"
                      variant="outline"
                    >
                      Reject
                    </Button>
                  </div>
                </form>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function MetricCard({
  label,
  value,
  tone = "slate",
}: {
  label: string
  value: number
  tone?: "slate" | "green" | "amber" | "red" | "blue"
}): JSX.Element {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <p className={cn("mt-2 text-2xl font-semibold", metricToneClass(tone))}>
          {value}
        </p>
      </CardContent>
    </Card>
  )
}

function DetailFact({
  label,
  value,
}: {
  label: string
  value: string | number
}): JSX.Element {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  )
}

function EmptyTeamState(): JSX.Element {
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>No direct reports yet</CardTitle>
        <CardDescription>
          The team cockpit populates from employees whose manager is your
          employee record.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-slate-600">
        If this looks wrong, confirm the demo seed has assigned direct reports
        to your manager profile.
      </CardContent>
    </Card>
  )
}

function CockpitErrorState({
  reason,
  detail,
}: {
  reason: LoaderFailureReason
  detail?: string
}): JSX.Element {
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Cannot load team cockpit</CardTitle>
        <CardDescription>{loaderReasonMessage(reason)}</CardDescription>
      </CardHeader>
      {detail ? (
        <CardContent className="text-sm text-slate-600">{detail}</CardContent>
      ) : null}
    </Card>
  )
}

function loaderReasonMessage(reason: LoaderFailureReason): string {
  switch (reason) {
    case "not_authenticated":
      return "You need to sign in before viewing the team cockpit."
    case "profile_not_found":
      return "Your user profile could not be found."
    case "employee_not_found":
      return "Your user profile is not linked to an employee record."
    case "not_found":
      return "The requested team data could not be found or is hidden by RLS."
    case "query_error":
      return "The database returned an unexpected error."
  }
}

function statusToneClass(tone: "red" | "amber" | "green" | "slate"): string {
  switch (tone) {
    case "red":
      return "bg-red-100 text-red-800"
    case "amber":
      return "bg-amber-100 text-amber-800"
    case "green":
      return "bg-emerald-100 text-emerald-800"
    default:
      return "bg-slate-100 text-slate-700"
  }
}

function metricToneClass(
  tone: "slate" | "green" | "amber" | "red" | "blue",
): string {
  switch (tone) {
    case "green":
      return "text-emerald-700"
    case "amber":
      return "text-amber-700"
    case "red":
      return "text-red-700"
    case "blue":
      return "text-blue-700"
    default:
      return "text-slate-950"
  }
}
