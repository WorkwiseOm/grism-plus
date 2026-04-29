import Link from "next/link"
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  ListChecks,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react"
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
import {
  approveIdpAction,
  generateAiIdpDraftAction,
  rejectIdpAction,
  requestIdpChangesAction,
} from "./actions"
import {
  APPROVAL_QUEUE_STATUS_ORDER,
  buildActionMix,
  buildApprovalQueueStats,
  canApproveIdpStatus,
  countActions,
  countMilestonesByStatus,
  filterApprovalQueueRows,
  formatDate,
  milestoneStatusLabel,
  modalityLabel,
  parseApprovalQueueStatusFilter,
  selectApprovalQueueRow,
  statusLabel,
  type ApprovalQueueStatusFilter,
} from "@/lib/idp-approval/queue"
import {
  blendCategoryDescription,
  blendGuardLabel,
  blendGuardTone,
  blendIssueSummary,
  buildIdpBlendPreview,
} from "@/lib/idp-blend/preview"
import { latestIdpReviewFeedback } from "@/lib/idp-approval/review"
import { cn } from "@/lib/utils"

type PageProps = {
  searchParams?: Promise<{
    idp?: string | string[]
    status?: string | string[]
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
  const statusFilter = parseApprovalQueueStatusFilter(firstParam(params?.status))
  const updated = firstParam(params?.updated)
  const error = firstParam(params?.error)
  const summaries = await getIdpSummaryList()

  if (!summaries.ok) {
    return <QueueErrorState reason={summaries.reason} detail={summaries.detail} />
  }

  const stats = buildApprovalQueueStats(summaries.data)
  const filteredRows = filterApprovalQueueRows(summaries.data, statusFilter)
  const selected = selectApprovalQueueRow(filteredRows, requestedId)
  const detail = selected ? await getIdpDetail(selected.id) : null
  const canApproveSelected = selected
    ? canApproveIdpStatus(selected.status)
    : false
  const notification = notificationFor(updated, error)

  return (
    <div className="flex flex-col gap-5">
      <header className="border-b border-slate-200 pb-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              L&amp;D workspace
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              IDP approval queue
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Review generated and manual development plans before they move
              into execution. Approval stores the 70/20/10 snapshot before the
              plan becomes active.
            </p>
          </div>
          {selected ? (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Selected plan
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-950">
                {selected.employee_full_name ?? "Unnamed employee"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                v{selected.version} · {statusLabel(selected.status)}
              </p>
            </div>
          ) : null}
        </div>
      </header>

      {notification ? <QueueNotification {...notification} /> : null}

      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard
          label="Visible IDPs"
          value={stats.total}
          description="Readable in this tenant"
          icon={FileText}
        />
        <MetricCard
          label="Pending approval"
          value={stats.pending}
          description="Awaiting L&D decision"
          tone="amber"
          icon={Clock3}
        />
        <MetricCard
          label="AI generated"
          value={stats.aiGenerated}
          description="Drafts with AI metadata"
          tone="blue"
          icon={Sparkles}
        />
        <MetricCard
          label="Stalled"
          value={stats.stalled}
          description="Needs intervention"
          tone="red"
          icon={AlertTriangle}
        />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(360px,0.78fr)_minmax(0,1.55fr)]">
        <Card className="overflow-hidden xl:sticky xl:top-5">
          <CardHeader className="border-b border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Review queue</CardTitle>
                <CardDescription>
                  {filteredRows.length} plan{filteredRows.length === 1 ? "" : "s"} in view.
                </CardDescription>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                {statusFilter === "all" ? "All statuses" : statusLabel(statusFilter)}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <StatusSummary
              rows={summaries.data}
              activeFilter={statusFilter}
            />
            <div className="max-h-[calc(100vh-310px)] overflow-y-auto">
              <QueueList
                rows={filteredRows}
                selectedId={selected?.id ?? null}
                statusFilter={statusFilter}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-slate-200 shadow-sm">
          {selected && detail?.ok ? (
            <SelectedIdpDetail
              summary={selected}
              detail={detail.data}
              canApproveSelected={canApproveSelected}
            />
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
  description,
  tone = "slate",
  icon: Icon,
}: {
  label: string
  value: number
  description: string
  tone?: "slate" | "amber" | "blue" | "red"
  icon: LucideIcon
}): JSX.Element {
  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <CardContent className="p-0">
        <div className={cn("h-1", metricAccentClass(tone))} />
        <div className="flex items-start justify-between gap-3 p-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              {label}
            </p>
            <p className={cn("mt-2 text-2xl font-semibold", metricToneClass(tone))}>
              {value}
            </p>
            <p className="mt-1 text-xs text-slate-500">{description}</p>
          </div>
          <span className={cn("rounded-md p-2", metricIconClass(tone))}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
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
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm font-medium shadow-sm",
        tone === "green"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-800",
      )}
    >
      {tone === "green" ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      <span>{message}</span>
    </div>
  )
}

function StatusSummary({
  rows,
  activeFilter,
}: {
  rows: IdpSummaryRow[]
  activeFilter: ApprovalQueueStatusFilter
}): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-2 border-b border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-3">
      <StatusFilterLink
        href="/admin/idps"
        label="All"
        count={rows.length}
        active={activeFilter === "all"}
      />
      {APPROVAL_QUEUE_STATUS_ORDER.map((status) => (
        <StatusFilterLink
          key={status}
          href={`/admin/idps?status=${status}`}
          label={statusLabel(status)}
          count={rows.filter((row) => row.status === status).length}
          active={activeFilter === status}
        />
      ))}
    </div>
  )
}

function StatusFilterLink({
  href,
  label,
  count,
  active,
}: {
  href: string
  label: string
  count: number
  active: boolean
}): JSX.Element {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center justify-between rounded-md border px-2.5 py-2 transition-colors",
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100",
      )}
    >
      <span className="truncate">{label}</span>
      <span
        className={cn(
          "ml-2 font-semibold",
          active ? "text-white" : "text-slate-900",
        )}
      >
        {count}
      </span>
    </Link>
  )
}

function QueueList({
  rows,
  selectedId,
  statusFilter,
}: {
  rows: IdpSummaryRow[]
  selectedId: string | null
  statusFilter: ApprovalQueueStatusFilter
}): JSX.Element {
  if (rows.length === 0) {
    return (
      <div className="p-6 text-sm text-slate-600">
        No IDPs match this queue filter.
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
            href={queueRowHref(row.id, statusFilter)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "block border-l-4 p-4 transition-colors",
              active
                ? "border-l-slate-900 bg-slate-100"
                : "border-l-transparent bg-white hover:bg-slate-50",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950">
                  {row.employee_full_name ?? "Unnamed employee"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  IDP v{row.version} · target {formatDate(row.target_completion_date)}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-1 text-xs font-medium",
                  statusBadgeClass(row.status),
                )}
              >
                {statusLabel(row.status)}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 font-medium",
                  row.generated_by_ai
                    ? "bg-blue-50 text-blue-700"
                    : "bg-slate-100 text-slate-600",
                )}
              >
                {row.generated_by_ai ? "AI draft" : "Manual draft"}
              </span>
              <span>Last activity {formatDate(row.last_activity_at)}</span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function queueRowHref(
  idpId: string,
  statusFilter: ApprovalQueueStatusFilter,
): string {
  const params = new URLSearchParams({ idp: idpId })
  if (statusFilter !== "all") params.set("status", statusFilter)
  return `/admin/idps?${params.toString()}`
}

function SelectedIdpDetail({
  summary,
  detail,
  canApproveSelected,
}: {
  summary: IdpSummaryRow
  detail: IdpDetail
  canApproveSelected: boolean
}): JSX.Element {
  const actionMix = buildActionMix(detail)
  const milestoneCounts = countMilestonesByStatus(detail)
  const actionCount = countActions(detail)
  const blendPreview = buildIdpBlendPreview(detail)
  const blendIssue = blendIssueSummary(blendPreview.guard)
  const latestReview = latestIdpReviewFeedback(detail.idp.ai_generation_metadata)
  const canReturnForRevision = detail.idp.status === "pending_approval"

  return (
    <>
      <CardHeader className="border-b border-slate-200 bg-white">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "w-fit rounded-full px-2.5 py-1 text-xs font-medium",
                  statusBadgeClass(detail.idp.status),
                )}
              >
                {statusLabel(detail.idp.status)}
              </span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium",
                  detail.idp.generated_by_ai
                    ? "bg-blue-50 text-blue-700"
                    : "bg-slate-100 text-slate-600",
                )}
              >
                {detail.idp.generated_by_ai ? "AI draft" : "Manual draft"}
              </span>
            </div>
            <CardTitle className="text-xl tracking-tight">
              {detail.employee?.full_name ?? summary.employee_full_name ?? "IDP"}
            </CardTitle>
            <CardDescription className="mt-1">
              {detail.employee?.role_title ?? "Role not set"}
              {detail.employee?.target_role_title
                ? ` -> ${detail.employee.target_role_title}`
                : ""}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={generateAiIdpDraftAction}>
              <input type="hidden" name="idpId" value={detail.idp.id} />
              <Button type="submit" variant="outline" className="gap-2">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Generate AI draft
              </Button>
            </form>
            <form action={approveIdpAction}>
              <input type="hidden" name="idpId" value={detail.idp.id} />
              <Button type="submit" disabled={!canApproveSelected} className="gap-2">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Approve IDP
              </Button>
            </form>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 bg-white p-5">
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
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                <ListChecks className="h-4 w-4 text-slate-500" aria-hidden="true" />
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
                actualPct={item.actualPct}
                targetPct={item.targetPct}
                tone={blendCategoryTone(item.category)}
                description={`${blendCategoryDescription(item.category)} · target ${item.targetPct}%`}
              />
            ))}
          </div>
          {blendIssue ? (
            <p className="mt-3 text-xs font-medium text-red-700">{blendIssue}</p>
          ) : null}
        </section>

        <section className="rounded-lg border border-slate-200 p-4">
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
                      className="h-2 rounded-full bg-slate-900 transition-all"
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

        <section className="rounded-lg border border-slate-200 p-4">
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
                className="rounded-lg border border-slate-200 bg-white p-4"
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
          <section className="rounded-lg border border-blue-100 bg-blue-50/60 p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <Sparkles className="h-4 w-4 text-blue-600" aria-hidden="true" />
              Narrative
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {detail.idp.narrative}
            </p>
          </section>
        ) : null}

        {latestReview ? <LatestReviewFeedback entry={latestReview} /> : null}

        <section className="rounded-lg border border-slate-200 p-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold text-slate-950">
              Return for revision
            </h2>
            <p className="text-xs text-slate-600">
              Request changes keeps the IDP pending. Reject moves it back to
              draft and increments the version.
            </p>
          </div>
          {canReturnForRevision ? (
            <form className="mt-3 space-y-3">
              <input type="hidden" name="idpId" value={detail.idp.id} />
              <textarea
                name="reviewComment"
                minLength={10}
                maxLength={1200}
                required
                rows={3}
                placeholder="Tell the author what needs to change before this plan can move forward."
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  variant="outline"
                  formAction={requestIdpChangesAction}
                >
                  Request changes
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  formAction={rejectIdpAction}
                >
                  Reject to draft
                </Button>
              </div>
            </form>
          ) : (
            <p className="mt-3 text-sm text-slate-600">
              Revision actions are available only while the IDP is pending
              approval.
            </p>
          )}
        </section>
      </CardContent>
    </>
  )
}

function LatestReviewFeedback({
  entry,
}: {
  entry: NonNullable<ReturnType<typeof latestIdpReviewFeedback>>
}): JSX.Element {
  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-amber-950">
          Latest review feedback
        </h2>
        <p className="text-xs text-amber-800">
          {entry.disposition === "rejected"
            ? "Rejected to draft"
            : "Changes requested"}{" "}
          on {formatDate(entry.reviewed_at)}.
        </p>
      </div>
      <p className="mt-3 text-sm leading-6 text-amber-950">{entry.comment}</p>
    </section>
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
  actualPct,
  targetPct,
  tone,
  description,
}: {
  label: string
  value: string
  actualPct: number
  targetPct: number
  tone: "emerald" | "blue" | "slate"
  description: string
}): JSX.Element {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-xs text-slate-400">Target {targetPct}%</p>
      </div>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
      <div className="mt-2 h-2 rounded-full bg-slate-100">
        <div
          className={cn("h-2 rounded-full", blendBarClass(tone))}
          style={{ width: `${Math.min(100, Math.max(0, actualPct))}%` }}
        />
      </div>
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

function metricAccentClass(tone: "slate" | "amber" | "blue" | "red"): string {
  switch (tone) {
    case "amber":
      return "bg-amber-500"
    case "blue":
      return "bg-blue-600"
    case "red":
      return "bg-red-500"
    default:
      return "bg-slate-900"
  }
}

function metricIconClass(tone: "slate" | "amber" | "blue" | "red"): string {
  switch (tone) {
    case "amber":
      return "bg-amber-50 text-amber-700"
    case "blue":
      return "bg-blue-50 text-blue-700"
    case "red":
      return "bg-red-50 text-red-700"
    default:
      return "bg-slate-100 text-slate-700"
  }
}

function blendCategoryTone(
  category: "experience" | "relationship" | "formal",
): "emerald" | "blue" | "slate" {
  switch (category) {
    case "experience":
      return "emerald"
    case "relationship":
      return "blue"
    case "formal":
      return "slate"
  }
}

function blendBarClass(tone: "emerald" | "blue" | "slate"): string {
  switch (tone) {
    case "emerald":
      return "bg-emerald-600"
    case "blue":
      return "bg-blue-600"
    case "slate":
      return "bg-slate-700"
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
  if (updated === "ai_draft_generated") {
    return {
      tone: "green",
      message: "AI draft generated and stored for review.",
    }
  }
  if (updated === "changes_requested") {
    return {
      tone: "green",
      message: "Changes requested. The review comment is now on the IDP.",
    }
  }
  if (updated === "rejected") {
    return {
      tone: "green",
      message: "IDP rejected to draft with review feedback preserved.",
    }
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
    case "not_reviewable":
      return {
        tone: "red",
        message: "Only pending-approval IDPs can be returned for revision.",
      }
    case "review_comment_required":
      return {
        tone: "red",
        message: "Add a short review comment before returning the IDP.",
      }
    case "review_comment_too_long":
      return {
        tone: "red",
        message: "Review comment is too long. Keep it under 1,200 characters.",
      }
    case "review_update_failed":
      return {
        tone: "red",
        message: "Review feedback could not be saved. Try again.",
      }
    case "approve_failed":
      return {
        tone: "red",
        message: "Approval failed. Refresh the queue and try again.",
      }
    case "blend_snapshot_failed":
      return {
        tone: "red",
        message:
          "The 70/20/10 snapshot could not be stored, so the IDP was not approved.",
      }
    case "ai_employee_missing":
      return {
        tone: "red",
        message: "AI draft generation could not find the employee context.",
      }
    case "ai_no_gaps":
      return {
        tone: "red",
        message:
          "AI draft generation needs at least one competency-linked milestone.",
      }
    case "ai_generation_failed":
      return {
        tone: "red",
        message:
          "AI draft generation failed or returned a draft outside the guardrails.",
      }
    case "ai_update_failed":
      return {
        tone: "red",
        message: "AI draft was generated but could not be stored.",
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
