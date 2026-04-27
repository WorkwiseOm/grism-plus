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
import { getIdpDetail, getIdpSummaryList } from "@/lib/data/idps"
import type { IdpDetail, IdpSummaryRow } from "@/lib/data/idps"
import type { LoaderFailureReason } from "@/lib/data/types"
import { approveIdpAction } from "./actions"
import {
  APPROVAL_QUEUE_STATUS_ORDER,
  buildActionMix,
  buildApprovalQueueStats,
  canApproveIdpStatus,
  countActions,
  countMilestonesByStatus,
  formatDate,
  milestoneStatusLabel,
  modalityLabel,
  selectApprovalQueueRow,
  statusLabel,
} from "@/lib/idp-approval/queue"
import {
  blendCategoryDescription,
  blendGuardLabel,
  blendGuardTone,
  blendIssueSummary,
  buildIdpBlendPreview,
} from "@/lib/idp-blend/preview"
import { cn } from "@/lib/utils"

type PageProps = {
  searchParams?: Promise<{
    idp?: string | string[]
    updated?: string | string[]
    error?: string | string[]
  }>
}

export default async function AdminIdpsPage({
  searchParams,
}: PageProps): Promise<JSX.Element> {
  await requireRole(["ld_admin", "superadmin"])

  const params = await searchParams
  const requestedId = firstParam(params?.idp)
  const updated = firstParam(params?.updated)
  const error = firstParam(params?.error)
  const summaries = await getIdpSummaryList()

  if (!summaries.ok) {
    return <QueueErrorState reason={summaries.reason} detail={summaries.detail} />
  }

  const stats = buildApprovalQueueStats(summaries.data)
  const selected = selectApprovalQueueRow(summaries.data, requestedId)
  const detail = selected ? await getIdpDetail(selected.id) : null
  const canApproveSelected = selected
    ? canApproveIdpStatus(selected.status)
    : false
  const notification = notificationFor(updated, error)

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          L&amp;D workspace
        </p>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              IDP approval queue
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Review generated and manual development plans before they move
              into execution. Approval actions stay disabled until the Phase 1
              schema is applied and verified.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={approveIdpAction}>
              <input type="hidden" name="idpId" value={selected?.id ?? ""} />
              <Button type="submit" disabled={!selected || !canApproveSelected}>
                Approve IDP
              </Button>
            </form>
            <Button variant="outline" disabled>
              Request changes
            </Button>
          </div>
        </div>
      </header>

      {notification ? <QueueNotification {...notification} /> : null}

      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Visible IDPs" value={stats.total} />
        <MetricCard label="Pending approval" value={stats.pending} tone="amber" />
        <MetricCard label="AI generated" value={stats.aiGenerated} tone="blue" />
        <MetricCard label="Stalled" value={stats.stalled} tone="red" />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.4fr)]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-slate-200">
            <CardTitle className="text-base">Queue</CardTitle>
            <CardDescription>
              RLS decides which IDPs this admin can read.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <StatusSummary rows={summaries.data} />
            <QueueList rows={summaries.data} selectedId={selected?.id ?? null} />
          </CardContent>
        </Card>

        <Card>
          {selected && detail?.ok ? (
            <SelectedIdpDetail summary={selected} detail={detail.data} />
          ) : selected && detail && !detail.ok ? (
            <QueueErrorState
              reason={detail.reason}
              detail={detail.detail}
              title="Cannot load selected IDP"
            />
          ) : (
            <EmptyDetailState />
          )}
        </Card>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  tone = "slate",
}: {
  label: string
  value: number
  tone?: "slate" | "amber" | "blue" | "red"
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

function QueueNotification({
  tone,
  message,
}: {
  tone: "green" | "red"
  message: string
}): JSX.Element {
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3 text-sm font-medium",
        tone === "green"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-800",
      )}
    >
      {message}
    </div>
  )
}

function StatusSummary({ rows }: { rows: IdpSummaryRow[] }): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-2 border-b border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-3">
      {APPROVAL_QUEUE_STATUS_ORDER.map((status) => {
        const count = rows.filter((row) => row.status === status).length
        return (
          <div
            key={status}
            className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-2 py-1.5"
          >
            <span className="text-slate-600">{statusLabel(status)}</span>
            <span className="font-semibold text-slate-900">{count}</span>
          </div>
        )
      })}
    </div>
  )
}

function QueueList({
  rows,
  selectedId,
}: {
  rows: IdpSummaryRow[]
  selectedId: string | null
}): JSX.Element {
  if (rows.length === 0) {
    return (
      <div className="p-6 text-sm text-slate-600">
        No IDPs are visible for this tenant yet.
      </div>
    )
  }

  const ordered = [...rows].sort((a, b) => {
    const statusDelta =
      APPROVAL_QUEUE_STATUS_ORDER.indexOf(a.status) -
      APPROVAL_QUEUE_STATUS_ORDER.indexOf(b.status)
    if (statusDelta !== 0) return statusDelta
    return (b.last_activity_at ?? "").localeCompare(a.last_activity_at ?? "")
  })

  return (
    <div className="divide-y divide-slate-200">
      {ordered.map((row) => {
        const active = row.id === selectedId
        return (
          <Link
            key={row.id}
            href={`/admin/idps?idp=${row.id}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "block p-4 transition-colors",
              active ? "bg-slate-900 text-white" : "hover:bg-slate-50",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {row.employee_full_name ?? "Unnamed employee"}
                </p>
                <p
                  className={cn(
                    "mt-1 text-xs",
                    active ? "text-slate-300" : "text-slate-500",
                  )}
                >
                  IDP v{row.version} · target {formatDate(row.target_completion_date)}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-1 text-xs font-medium",
                  active ? "bg-white/15 text-white" : statusBadgeClass(row.status),
                )}
              >
                {statusLabel(row.status)}
              </span>
            </div>
            <div
              className={cn(
                "mt-3 flex items-center gap-3 text-xs",
                active ? "text-slate-300" : "text-slate-500",
              )}
            >
              <span>{row.generated_by_ai ? "AI draft" : "Manual draft"}</span>
              <span>Last activity {formatDate(row.last_activity_at)}</span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function SelectedIdpDetail({
  summary,
  detail,
}: {
  summary: IdpSummaryRow
  detail: IdpDetail
}): JSX.Element {
  const actionMix = buildActionMix(detail)
  const milestoneCounts = countMilestonesByStatus(detail)
  const actionCount = countActions(detail)
  const blendPreview = buildIdpBlendPreview(detail)
  const blendIssue = blendIssueSummary(blendPreview.guard)

  return (
    <>
      <CardHeader className="border-b border-slate-200">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-xl">
              {detail.employee?.full_name ?? summary.employee_full_name ?? "IDP"}
            </CardTitle>
            <CardDescription className="mt-1">
              {detail.employee?.role_title ?? "Role not set"}
              {detail.employee?.target_role_title
                ? ` -> ${detail.employee.target_role_title}`
                : ""}
            </CardDescription>
          </div>
          <span
            className={cn(
              "w-fit rounded-full px-2.5 py-1 text-xs font-medium",
              statusBadgeClass(detail.idp.status),
            )}
          >
            {statusLabel(detail.idp.status)}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-5">
        <section className="grid gap-3 md:grid-cols-3">
          <CompactFact label="Version" value={`v${detail.idp.version}`} />
          <CompactFact
            label="Target date"
            value={formatDate(detail.idp.target_completion_date)}
          />
          <CompactFact label="Actions" value={String(actionCount)} />
        </section>

        <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">
                Development blend guard
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                Computed from planned actions until approved blend snapshots are
                available.
              </p>
            </div>
            <span
              className={cn(
                "rounded-full px-2 py-1 text-xs font-medium",
                blendGuardBadgeClass(blendGuardTone(blendPreview.guard)),
              )}
            >
              {blendGuardLabel(blendPreview.guard)}
            </span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {blendPreview.items.map((item) => (
              <BlendTarget
                key={item.category}
                label={item.label}
                value={`${item.actualPct}%`}
                description={`${blendCategoryDescription(item.category)} · target ${item.targetPct}%`}
              />
            ))}
          </div>
          {blendIssue ? (
            <p className="mt-3 text-xs font-medium text-red-700">{blendIssue}</p>
          ) : null}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-950">
              Current action mix
            </h2>
            <span className="text-xs text-slate-500">
              {actionCount} action{actionCount === 1 ? "" : "s"}
            </span>
          </div>
          {actionMix.length > 0 ? (
            <div className="space-y-2">
              {actionMix.map((item) => (
                <div key={item.modality} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-700">{item.label}</span>
                    <span className="text-slate-500">
                      {item.count} · {item.percentage}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-slate-900"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              No actions are attached to this IDP yet.
            </p>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-950">Milestones</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-5">
            {Object.entries(milestoneCounts).map(([status, count]) => (
              <CompactFact
                key={status}
                label={milestoneStatusLabel(status as keyof typeof milestoneCounts)}
                value={String(count)}
              />
            ))}
          </div>
          <div className="mt-4 space-y-3">
            {detail.milestones.map((milestone) => (
              <div
                key={milestone.milestone.id}
                className="rounded-lg border border-slate-200 p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      {milestone.milestone.sequence_order}.{" "}
                      {milestone.milestone.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {milestone.competency
                        ? `${milestone.competency.code} · ${milestone.competency.name}`
                        : "No competency metadata"}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                    {milestoneStatusLabel(milestone.milestone.status)}
                  </span>
                </div>
                {milestone.actions.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {milestone.actions.map((action) => (
                      <span
                        key={action.id}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                      >
                        {modalityLabel(action.modality)} · {action.title}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        {detail.idp.narrative ? (
          <section className="rounded-lg border border-slate-200 p-4">
            <h2 className="text-sm font-semibold text-slate-950">Narrative</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {detail.idp.narrative}
            </p>
          </section>
        ) : null}
      </CardContent>
    </>
  )
}

function CompactFact({
  label,
  value,
}: {
  label: string
  value: string
}): JSX.Element {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  )
}

function BlendTarget({
  label,
  value,
  description,
}: {
  label: string
  value: string
  description: string
}): JSX.Element {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </div>
  )
}

function EmptyDetailState(): JSX.Element {
  return (
    <>
      <CardHeader>
        <CardTitle className="text-base">No IDPs to review</CardTitle>
        <CardDescription>
          The queue will populate once demo seed or tenant data creates IDPs.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-slate-600">
        This screen is read-only until approval actions are wired to audited
        server mutations.
      </CardContent>
    </>
  )
}

function QueueErrorState({
  reason,
  detail,
  title = "Cannot load IDP approval queue",
}: {
  reason: LoaderFailureReason
  detail?: string
  title?: string
}): JSX.Element {
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
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
      return "You need to sign in before viewing the approval queue."
    case "profile_not_found":
      return "Your user profile could not be found."
    case "employee_not_found":
      return "Your profile is missing an employee record."
    case "not_found":
      return "The selected IDP could not be found or is hidden by RLS."
    case "query_error":
      return "The database returned an unexpected error."
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "pending_approval":
      return "bg-amber-100 text-amber-800"
    case "active":
      return "bg-emerald-100 text-emerald-800"
    case "stalled":
      return "bg-red-100 text-red-800"
    case "completed":
      return "bg-blue-100 text-blue-800"
    default:
      return "bg-slate-100 text-slate-700"
  }
}

function metricToneClass(tone: "slate" | "amber" | "blue" | "red"): string {
  switch (tone) {
    case "amber":
      return "text-amber-700"
    case "blue":
      return "text-blue-700"
    case "red":
      return "text-red-700"
    default:
      return "text-slate-950"
  }
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function notificationFor(
  updated: string | undefined,
  error: string | undefined,
): { tone: "green" | "red"; message: string } | null {
  if (updated === "approved") {
    return { tone: "green", message: "IDP approved and moved to active." }
  }

  switch (error) {
    case "missing_idp":
      return { tone: "red", message: "Select an IDP before approving." }
    case "not_found":
      return {
        tone: "red",
        message: "The selected IDP could not be found or is no longer visible.",
      }
    case "not_approvable":
      return {
        tone: "red",
        message: "Only draft or pending-approval IDPs can be approved.",
      }
    case "approve_failed":
      return {
        tone: "red",
        message: "Approval failed. Refresh the queue and try again.",
      }
    default:
      return null
  }
}

function blendGuardBadgeClass(tone: "green" | "amber" | "red"): string {
  switch (tone) {
    case "green":
      return "bg-emerald-100 text-emerald-800"
    case "amber":
      return "bg-amber-100 text-amber-800"
    case "red":
      return "bg-red-100 text-red-800"
  }
}
