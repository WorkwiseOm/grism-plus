import Link from "next/link"
import {
  Activity,
  AlertOctagon,
  CheckCircle2,
  ListChecks,
  ListTree,
  Sparkles,
  Target,
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
import {
  getCurrentEmployeeContext,
  getEmployeeOjtAssignments,
  getIdpDetail,
  getIdpSummaryList,
} from "@/lib/data"
import type {
  IdpDetail,
  IdpDetailMilestone,
  IdpSummaryRow,
  LoaderFailureReason,
  LoaderResult,
  OjtAssignmentDetail,
} from "@/lib/data"
import {
  buildEmployeeIdpStats,
  calculateMilestoneCompletionPercent,
  formatDate,
  getNextMilestone,
  modalityLabel,
  selectEmployeeWorkspaceIdp,
  statusLabel,
} from "@/lib/employee-idp/workspace"
import {
  blendCategoryDescription,
  blendGuardLabel,
  blendGuardTone,
  blendIssueSummary,
  buildIdpBlendPreview,
} from "@/lib/idp-blend/preview"
import { latestIdpReviewFeedback } from "@/lib/idp-approval/review"
import { cn } from "@/lib/utils"
import { submitOjtEvidenceAction } from "./actions"

type PageProps = {
  searchParams?: Promise<{ idp?: string | string[] }>
}

export default async function EmployeeIdpPage({
  searchParams,
}: PageProps): Promise<JSX.Element> {
  await requireRole(["employee"])

  const context = await getCurrentEmployeeContext()
  if (!context.ok) {
    return <WorkspaceErrorState reason={context.reason} detail={context.detail} />
  }
  if (!context.data.employee) {
    return <WorkspaceErrorState reason="employee_not_found" />
  }

  const params = await searchParams
  const requestedId = Array.isArray(params?.idp) ? params?.idp[0] : params?.idp
  const summaries = await getIdpSummaryList({
    employeeIds: [context.data.employee.id],
  })

  if (!summaries.ok) {
    return (
      <WorkspaceErrorState reason={summaries.reason} detail={summaries.detail} />
    )
  }

  const ojtAssignments = await getEmployeeOjtAssignments(
    context.data.employee.id,
  )
  const selected = selectEmployeeWorkspaceIdp(summaries.data, requestedId)
  const detail = selected ? await getIdpDetail(selected.id) : null

  return (
    <div className="flex flex-col gap-5">
      <header className="border-b border-slate-200 pb-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Employee workspace
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              IDP workspace
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Track your active development plan, next actions, and evidence
              tasks. OJT evidence is submitted through audited server-side
              validation paths.
            </p>
          </div>
          {selected ? (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Active plan
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-950">
                IDP v{selected.version}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {statusLabel(selected.status)} · target{" "}
                {formatDate(selected.target_completion_date)}
              </p>
            </div>
          ) : null}
        </div>
      </header>

      {selected && detail?.ok ? (
        <WorkspaceDetail
          summaries={summaries.data}
          selected={selected}
          detail={detail.data}
          ojtAssignments={ojtAssignments}
        />
      ) : selected && detail && !detail.ok ? (
        <WorkspaceErrorState
          reason={detail.reason}
          detail={detail.detail}
          title="Cannot load selected IDP"
        />
      ) : (
        <EmptyWorkspaceState />
      )}
    </div>
  )
}

function WorkspaceDetail({
  summaries,
  selected,
  detail,
  ojtAssignments,
}: {
  summaries: IdpSummaryRow[]
  selected: IdpSummaryRow
  detail: IdpDetail
  ojtAssignments: LoaderResult<OjtAssignmentDetail[]>
}): JSX.Element {
  const stats = buildEmployeeIdpStats(detail)
  const completion = calculateMilestoneCompletionPercent(detail)
  const nextMilestone = getNextMilestone(detail)
  const blendPreview = buildIdpBlendPreview(detail)
  const blendIssue = blendIssueSummary(blendPreview.guard)
  const latestReview = latestIdpReviewFeedback(detail.idp.ai_generation_metadata)

  return (
    <>
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Milestones"
          value={stats.milestoneCount}
          description="In this plan"
          icon={ListTree}
        />
        <MetricCard
          label="Actions"
          value={stats.actionCount}
          description="Across all milestones"
          icon={ListChecks}
        />
        <MetricCard
          label="In progress"
          value={stats.inProgressMilestones}
          description="Active milestones"
          tone="amber"
          icon={Activity}
        />
        <MetricCard
          label="Blocked"
          value={stats.blockedMilestones}
          description="Need attention"
          tone="red"
          icon={AlertOctagon}
        />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.78fr)]">
        <div className="flex flex-col gap-5">
          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold text-slate-950">
                      {detail.employee?.target_role_title ??
                        detail.employee?.role_title ??
                        "Development plan"}
                    </h2>
                    <span
                      className={cn(
                        "rounded-full px-2 py-1 text-xs font-medium",
                        statusBadgeClass(detail.idp.status),
                      )}
                    >
                      {statusLabel(detail.idp.status)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    IDP v{detail.idp.version} · target{" "}
                    {formatDate(detail.idp.target_completion_date)}
                  </p>
                </div>
                <div className="min-w-44 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                      Milestone progress
                    </p>
                    <Target
                      className="h-3.5 w-3.5 text-slate-400"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {completion}%
                  </p>
                  <div className="mt-2 h-2 rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-slate-900"
                      style={{ width: `${completion}%` }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 bg-white p-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-950">
                  70/20/10 development model
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-slate-600">
                  Current mix based on the actions attached to this plan.
                </p>
              </div>
              <span
                className={cn(
                  "w-fit rounded-full px-2.5 py-1 text-xs font-medium",
                  blendGuardBadgeClass(blendGuardTone(blendPreview.guard)),
                )}
              >
                {blendGuardLabel(blendPreview.guard)}
              </span>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-3">
              {blendPreview.items.map((item) => (
                <BlendColumn
                  key={item.category}
                  label={item.label}
                  value={`${item.actualPct}%`}
                  description={`${blendCategoryDescription(item.category)} · target ${item.targetPct}%`}
                />
              ))}
            </div>
            {blendIssue ? (
              <p className="border-t border-slate-200 bg-red-50 px-5 py-3 text-xs font-medium text-red-800">
                {blendIssue}
              </p>
            ) : null}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="rounded-md bg-blue-100 p-2 text-blue-700">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-slate-950">
                    What&apos;s next
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    The next open milestone and its planned actions.
                  </p>
                </div>
              </div>
            </div>
            {nextMilestone ? (
              <NextMilestoneCard item={nextMilestone} />
            ) : (
              <p className="mt-4 text-sm text-slate-600">
                All milestones in this plan are completed or skipped.
              </p>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-950">
              Execution stream
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              All milestones in plan order with their attached actions.
            </p>
            <div className="mt-5 space-y-4">
              {detail.milestones.map((item) => (
                <MilestoneTimelineItem key={item.milestone.id} item={item} />
              ))}
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-5 xl:sticky xl:top-5 xl:self-start">
          {latestReview ? <LatestReviewFeedback entry={latestReview} /> : null}

          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-200 bg-white">
              <CardTitle className="text-base">My IDPs</CardTitle>
              <CardDescription>
                Visible plans for your employee record.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-3">
              {summaries.map((row) => (
                <Link
                  key={row.id}
                  href={`/employee/idp?idp=${row.id}`}
                  aria-current={row.id === selected.id ? "page" : undefined}
                  className={cn(
                    "block rounded-md border px-3 py-2 text-sm transition-colors",
                    row.id === selected.id
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 hover:bg-slate-50",
                  )}
                >
                  <span className="font-medium">IDP v{row.version}</span>
                  <span
                    className={cn(
                      "mt-1 block text-xs",
                      row.id === selected.id ? "text-slate-300" : "text-slate-500",
                    )}
                  >
                    {statusLabel(row.status)} · target{" "}
                    {formatDate(row.target_completion_date)}
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>

          <OjtAssignmentsCard result={ojtAssignments} />

          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-200 bg-white">
              <CardTitle className="text-base">People</CardTitle>
              <CardDescription>Execution support</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-5 text-sm">
              <PersonLine
                label="Employee"
                value={detail.employee?.full_name ?? "You"}
              />
              <PersonLine
                label="Current role"
                value={detail.employee?.role_title ?? "Not set"}
              />
              <PersonLine
                label="Department"
                value={detail.employee?.department ?? "Not set"}
              />
              <p className="border-t border-slate-200 pt-3 text-xs text-slate-500">
                Manager, coach, and L&amp;D owner names need a follow-up loader
                extension. This screen avoids extra admin-client reads.
              </p>
            </CardContent>
          </Card>

          {detail.idp.narrative ? (
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-200 bg-white">
                <CardTitle className="text-base">Plan narrative</CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <p className="text-sm leading-6 text-slate-700">
                  {detail.idp.narrative}
                </p>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </>
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
  tone?: "slate" | "green" | "amber" | "red" | "blue"
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

function LatestReviewFeedback({
  entry,
}: {
  entry: NonNullable<ReturnType<typeof latestIdpReviewFeedback>>
}): JSX.Element {
  return (
    <Card className="overflow-hidden border-amber-200 bg-amber-50 shadow-sm">
      <CardHeader className="border-b border-amber-200">
        <div className="flex items-start gap-3">
          <span className="rounded-md bg-amber-200/60 p-2 text-amber-900">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <CardTitle className="text-base text-amber-950">
              L&amp;D feedback
            </CardTitle>
            <CardDescription className="text-amber-800">
              {entry.disposition === "rejected"
                ? "Returned to draft"
                : "Changes requested"}{" "}
              on {formatDate(entry.reviewed_at)}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        <p className="text-sm leading-6 text-amber-950">{entry.comment}</p>
      </CardContent>
    </Card>
  )
}

function OjtAssignmentsCard({
  result,
}: {
  result: LoaderResult<OjtAssignmentDetail[]>
}): JSX.Element {
  const items = result.ok ? result.data : []
  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-200 bg-white">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">OJT assignments</CardTitle>
            <CardDescription>
              Experience-led work tied to this IDP.
            </CardDescription>
          </div>
          {result.ok && items.length > 0 ? (
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
              {items.length}
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-3">
        {!result.ok ? (
          <p className="p-2 text-sm text-slate-600">
            OJT assignments could not be loaded.
          </p>
        ) : items.length === 0 ? (
          <p className="p-2 text-sm text-slate-600">
            No OJT assignments are visible yet.
          </p>
        ) : (
          items
            .slice(0, 4)
            .map((item) => (
              <OjtAssignmentCard key={item.assignment.id} item={item} />
            ))
        )}
      </CardContent>
    </Card>
  )
}

function OjtAssignmentCard({
  item,
}: {
  item: OjtAssignmentDetail
}): JSX.Element {
  const canSubmit = ["assigned", "in_progress", "rejected"].includes(
    item.assignment.status,
  )

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-950">
          {item.catalogue?.title ?? "OJT assignment"}
        </p>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-1 text-xs font-medium",
            ojtStatusBadgeClass(item.assignment.status),
          )}
        >
          {ojtStatusLabel(item.assignment.status)}
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Due {formatDate(item.assignment.due_date)}
        {item.catalogue ? ` · ${item.catalogue.effort_hours}h expected` : ""}
      </p>
      {item.latestEvidence ? (
        <p className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-600">
          Evidence submitted {formatDate(item.latestEvidence.submitted_at)}
          {item.latestEvidence.validation_status
            ? ` · ${evidenceStatusLabel(item.latestEvidence.validation_status)}`
            : ""}
        </p>
      ) : null}
      {canSubmit ? (
        <form action={submitOjtEvidenceAction} className="mt-3 space-y-2">
          <input type="hidden" name="assignmentId" value={item.assignment.id} />
          <textarea
            name="selfReflection"
            minLength={20}
            required
            rows={3}
            placeholder="Summarise what you completed and what evidence the manager should review."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          />
          <Button type="submit" size="sm">
            Submit evidence
          </Button>
        </form>
      ) : null}
    </div>
  )
}

function BlendColumn({
  label,
  value,
  description,
}: {
  label: string
  value: string
  description: string
}): JSX.Element {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-600">{description}</p>
    </div>
  )
}

function NextMilestoneCard({
  item,
}: {
  item: IdpDetailMilestone
}): JSX.Element {
  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-950">
            {item.milestone.title}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {item.competency
              ? `${item.competency.code} · ${item.competency.name}`
              : "No competency metadata"}
          </p>
        </div>
        <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700">
          {statusLabel(item.milestone.status)}
        </span>
      </div>
      {item.actions.length > 0 ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {item.actions.map((action) => (
            <div
              key={action.id}
              className="rounded-md border border-slate-200 bg-white p-3"
            >
              <p className="text-xs font-medium text-slate-500">
                {modalityLabel(action.modality)}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-950">
                {action.title}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-600">
          No actions are attached to this milestone yet.
        </p>
      )}
    </div>
  )
}

function MilestoneTimelineItem({
  item,
}: {
  item: IdpDetailMilestone
}): JSX.Element {
  return (
    <div className="relative pl-5">
      <span
        className={cn(
          "absolute left-0 top-3 h-2 w-2 rounded-full ring-4",
          milestoneDotClass(item.milestone.status),
        )}
        aria-hidden="true"
      />
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-950">
              {item.milestone.sequence_order}. {item.milestone.title}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Due {formatDate(item.milestone.target_date)}
              {item.competency
                ? ` · ${item.competency.code} ${item.competency.name}`
                : ""}
            </p>
          </div>
          <span
            className={cn(
              "w-fit rounded-full px-2 py-1 text-xs font-medium",
              statusBadgeClass(item.milestone.status),
            )}
          >
            {statusLabel(item.milestone.status)}
          </span>
        </div>
        {item.milestone.description ? (
          <p className="mt-3 text-sm text-slate-700">
            {item.milestone.description}
          </p>
        ) : null}
        {item.actions.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {item.actions.map((action) => (
              <span
                key={action.id}
                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
              >
                {modalityLabel(action.modality)} · {action.title}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function PersonLine({
  label,
  value,
}: {
  label: string
  value: string
}): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-950">{value}</span>
    </div>
  )
}

function EmptyWorkspaceState(): JSX.Element {
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>No active IDP yet</CardTitle>
        <CardDescription>
          Your workspace will populate once an L&amp;D admin approves or drafts
          an IDP for your employee record.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-slate-600">
        If you expected to see a plan here, contact your manager or L&amp;D
        owner.
      </CardContent>
    </Card>
  )
}

function WorkspaceErrorState({
  reason,
  detail,
  title = "Cannot load IDP workspace",
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
      return "You need to sign in before viewing your IDP workspace."
    case "profile_not_found":
      return "Your user profile could not be found."
    case "employee_not_found":
      return "Your user profile is not linked to an employee record."
    case "not_found":
      return "The selected IDP could not be found or is hidden by RLS."
    case "query_error":
      return "The database returned an unexpected error."
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "active":
    case "completed":
      return "bg-emerald-100 text-emerald-800"
    case "pending_approval":
    case "draft":
      return "bg-amber-100 text-amber-800"
    case "blocked":
    case "stalled":
      return "bg-red-100 text-red-800"
    default:
      return "bg-slate-100 text-slate-700"
  }
}

function milestoneDotClass(status: string): string {
  switch (status) {
    case "completed":
      return "bg-emerald-500 ring-emerald-100"
    case "in_progress":
      return "bg-blue-500 ring-blue-100"
    case "blocked":
      return "bg-red-500 ring-red-100"
    case "skipped":
      return "bg-slate-400 ring-slate-100"
    default:
      return "bg-slate-300 ring-slate-100"
  }
}

function ojtStatusLabel(
  status: OjtAssignmentDetail["assignment"]["status"],
): string {
  switch (status) {
    case "evidence_submitted":
      return "Evidence submitted"
    case "in_progress":
      return "In progress"
    default:
      return status
        .split("_")
        .map((part, index) =>
          index === 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part,
        )
        .join(" ")
  }
}

function evidenceStatusLabel(status: string): string {
  switch (status) {
    case "approved":
      return "Approved"
    case "changes_requested":
      return "Changes requested"
    case "rejected":
      return "Rejected"
    default:
      return status
  }
}

function ojtStatusBadgeClass(
  status: OjtAssignmentDetail["assignment"]["status"],
): string {
  switch (status) {
    case "validated":
      return "bg-emerald-100 text-emerald-800"
    case "evidence_submitted":
      return "bg-blue-100 text-blue-800"
    case "rejected":
      return "bg-red-100 text-red-800"
    case "in_progress":
      return "bg-amber-100 text-amber-800"
    default:
      return "bg-slate-100 text-slate-700"
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

function metricAccentClass(
  tone: "slate" | "green" | "amber" | "red" | "blue",
): string {
  switch (tone) {
    case "green":
      return "bg-emerald-500"
    case "amber":
      return "bg-amber-500"
    case "red":
      return "bg-red-500"
    case "blue":
      return "bg-blue-500"
    default:
      return "bg-slate-900"
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

function metricIconClass(
  tone: "slate" | "green" | "amber" | "red" | "blue",
): string {
  switch (tone) {
    case "green":
      return "bg-emerald-100 text-emerald-700"
    case "amber":
      return "bg-amber-100 text-amber-700"
    case "red":
      return "bg-red-100 text-red-700"
    case "blue":
      return "bg-blue-100 text-blue-700"
    default:
      return "bg-slate-100 text-slate-700"
  }
}
