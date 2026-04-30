import Link from "next/link"
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  GitBranch,
  ListTree,
  ShieldCheck,
  Wrench,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateCompetencyAction } from "@/app/admin/frameworks/actions"
import { requireRole } from "@/lib/auth/require-role"
import { getFrameworkImpactSummary, getFrameworkTree } from "@/lib/data"
import type { CompetencyNode, FrameworkTree } from "@/lib/data"
import type { LoaderFailureReason } from "@/lib/data"
import type { FrameworkImpactSummary } from "@/lib/framework-editor/impact"
import {
  competencyEditErrorMessage,
  FRAMEWORK_CATEGORIES,
} from "@/lib/framework-editor/edit"
import {
  buildFrameworkStats,
  categoryLabel,
  countDescendants,
  findCompetencyNode,
  flattenCompetencies,
  getProficiencyLevelCount,
  getProficiencyLevelLabels,
} from "@/lib/framework-editor/tree"
import { cn } from "@/lib/utils"

type PageProps = {
  searchParams?: Promise<{
    competency?: string | string[]
    error?: string | string[]
    updated?: string | string[]
  }>
}

export default async function AdminFrameworksPage({
  searchParams,
}: PageProps): Promise<JSX.Element> {
  await requireRole(["ld_admin", "superadmin"])

  const params = await searchParams
  const requestedCompetency = Array.isArray(params?.competency)
    ? params?.competency[0]
    : params?.competency
  const error = Array.isArray(params?.error) ? params?.error[0] : params?.error
  const updated = Array.isArray(params?.updated)
    ? params?.updated[0]
    : params?.updated

  const tree = await getFrameworkTree()
  if (!tree.ok) {
    return <FrameworkErrorState reason={tree.reason} detail={tree.detail} />
  }

  const selected = findCompetencyNode(tree.data.roots, requestedCompetency)
  const selectedScope = selected ? flattenCompetencies([selected]) : []
  const impact = selected
    ? await getFrameworkImpactSummary({
        competencyIds: selectedScope.map((node) => node.id),
        competencyCodes: selectedScope.map((node) => node.code),
      })
    : null

  return (
    <div className="flex flex-col gap-5">
      <header className="border-b border-slate-200 pb-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              L&amp;D workspace
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Framework editor
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Edit the active framework taxonomy for the current tenant.
              Publishing, version history, and draft branches remain deferred
              until the framework change model is finalized.
            </p>
          </div>
          <div className="flex flex-wrap items-stretch gap-2 lg:flex-col lg:items-end">
            {selected ? (
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Selected node
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-950">
                  {selected.name}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {selected.code} · {categoryLabel(selected.category)}
                </p>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                form="competency-edit-form"
                type="submit"
                disabled={!selected}
              >
                Save node
              </Button>
              <Button variant="outline" disabled>
                Publish taxonomy
              </Button>
            </div>
          </div>
        </div>
      </header>

      <FrameworkStatusBanner error={error} updated={updated} />

      <FrameworkOverview tree={tree.data} />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(300px,0.66fr)_minmax(0,1.5fr)_minmax(280px,0.55fr)]">
        <Card className="overflow-hidden border-slate-200 shadow-sm xl:sticky xl:top-5">
          <CardHeader className="border-b border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Taxonomy tree</CardTitle>
                <CardDescription>
                  {tree.data.framework.name} · v{tree.data.framework.version}
                </CardDescription>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                {tree.data.framework.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {tree.data.roots.length > 0 ? (
              <div className="max-h-[calc(100vh-310px)] overflow-y-auto divide-y divide-slate-100">
                {tree.data.roots.map((root) => (
                  <CompetencyTreeItem
                    key={root.id}
                    node={root}
                    depth={0}
                    selectedId={selected?.id ?? null}
                  />
                ))}
              </div>
            ) : (
              <p className="p-5 text-sm text-slate-600">
                This framework has no competencies yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-slate-200 shadow-sm">
          {selected ? (
            <SelectedCompetency node={selected} />
          ) : (
            <EmptyCompetencyState />
          )}
        </Card>

        <ImpactPanel
          node={selected}
          impact={impact?.ok ? impact.data : null}
          impactError={
            impact && !impact.ok ? loaderReasonMessage(impact.reason) : null
          }
        />
      </div>
    </div>
  )
}

function FrameworkStatusBanner({
  error,
  updated,
}: {
  error?: string
  updated?: string
}): JSX.Element | null {
  if (updated === "competency_saved") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 shadow-sm">
        <CheckCircle2
          className="mt-0.5 h-4 w-4 shrink-0"
          aria-hidden="true"
        />
        <span>Competency saved.</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 shadow-sm">
        <AlertTriangle
          className="mt-0.5 h-4 w-4 shrink-0"
          aria-hidden="true"
        />
        <span>{competencyEditErrorMessage(error)}</span>
      </div>
    )
  }

  return null
}

function FrameworkOverview({ tree }: { tree: FrameworkTree }): JSX.Element {
  const stats = buildFrameworkStats(tree)
  return (
    <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
      <MetricCard
        label="Competencies"
        value={stats.totalCompetencies}
        description="Active leaf + parent nodes"
        icon={ListTree}
      />
      <MetricCard
        label="Root nodes"
        value={stats.rootCount}
        description="Top-level groupings"
        icon={GitBranch}
      />
      <MetricCard
        label="Technical"
        value={stats.technical}
        description="Hard-skill scope"
        tone="blue"
        icon={Wrench}
      />
      <MetricCard
        label="Behavioural"
        value={stats.behavioural}
        description="Conduct + leadership"
        tone="green"
        icon={ShieldCheck}
      />
      <MetricCard
        label="Knowledge"
        value={stats.knowledge}
        description="Domain literacy"
        tone="amber"
        icon={Brain}
      />
    </section>
  )
}

function CompetencyTreeItem({
  node,
  depth,
  selectedId,
}: {
  node: CompetencyNode
  depth: number
  selectedId: string | null
}): JSX.Element {
  const active = node.id === selectedId
  return (
    <div>
      <Link
        href={`/admin/frameworks?competency=${node.id}`}
        aria-current={active ? "page" : undefined}
        className={cn(
          "block border-l-2 px-4 py-3 text-sm transition-colors",
          active
            ? "border-slate-900 bg-slate-900 text-white"
            : "border-transparent hover:bg-slate-50",
        )}
        style={{ paddingLeft: `${16 + depth * 18}px` }}
      >
        <span className="font-medium">{node.name}</span>
        <span
          className={cn(
            "mt-1 block text-xs",
            active ? "text-slate-300" : "text-slate-500",
          )}
        >
          {node.code} · {categoryLabel(node.category)}
        </span>
      </Link>
      {node.children.map((child) => (
        <CompetencyTreeItem
          key={child.id}
          node={child}
          depth={depth + 1}
          selectedId={selectedId}
        />
      ))}
    </div>
  )
}

function SelectedCompetency({ node }: { node: CompetencyNode }): JSX.Element {
  const levels = getProficiencyLevelLabels(node)
  const descendants = countDescendants(node)
  return (
    <>
      <CardHeader className="border-b border-slate-200 bg-white">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-xl">{node.name}</CardTitle>
              <span
                className={cn(
                  "rounded-full px-2 py-1 text-xs font-medium",
                  categoryBadgeClass(node.category),
                )}
              >
                {categoryLabel(node.category)}
              </span>
            </div>
            <CardDescription className="mt-1">
              {node.code}
            </CardDescription>
          </div>
          <span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
            {descendants} descendant{descendants === 1 ? "" : "s"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        <form
          id="competency-edit-form"
          action={updateCompetencyAction}
          className="space-y-6"
        >
          <input type="hidden" name="competencyId" value={node.id} />

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="space-y-2">
              <Label htmlFor="competency-name">Competency name</Label>
              <Input
                id="competency-name"
                name="name"
                defaultValue={node.name}
                maxLength={120}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="competency-category">Category</Label>
              <select
                id="competency-category"
                name="category"
                defaultValue={node.category}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {FRAMEWORK_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {categoryLabel(category)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="competency-description">Definition</Label>
            <textarea
              id="competency-description"
              name="description"
              defaultValue={node.description ?? ""}
              rows={5}
              maxLength={1000}
              className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="competency-levels">Proficiency levels</Label>
              <span className="text-xs text-slate-500">
                {getProficiencyLevelCount(node)} stored
              </span>
            </div>
            <textarea
              id="competency-levels"
              name="proficiencyLevels"
              defaultValue={levels.join("\n")}
              rows={Math.max(4, Math.min(levels.length + 1, 8))}
              className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            <p className="text-xs text-slate-500">
              One level per line. The editor stores the labels on the current
              active framework; draft publishing remains deferred.
            </p>
          </div>

          <section className="rounded-lg border border-dashed border-slate-300 bg-slate-50/40 p-4">
            <h2 className="text-sm font-semibold text-slate-950">
              Associated learning signals
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              70/20/10 signal mapping and downstream IDP impact analysis remain
              read-only here. This save path only updates taxonomy fields.
            </p>
          </section>

          <div className="flex justify-end">
            <Button type="submit">Save competency</Button>
          </div>
        </form>
      </CardContent>
    </>
  )
}

function ImpactPanel({
  node,
  impact,
  impactError,
}: {
  node: CompetencyNode | null
  impact: FrameworkImpactSummary | null
  impactError: string | null
}): JSX.Element {
  return (
    <aside className="flex flex-col gap-5 xl:sticky xl:top-5 xl:self-start">
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-200 bg-white">
          <CardTitle className="text-base">Impact analysis</CardTitle>
          <CardDescription>
            Read-only counts via the same RLS posture.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 p-5 text-sm">
          <ImpactLine label="Selected node" value={node?.name ?? "None"} />
          <ImpactLine
            label="Descendants"
            value={node ? String(countDescendants(node)) : "0"}
          />
          <ImpactLine
            label="Proficiency levels"
            value={node ? String(getProficiencyLevelCount(node)) : "0"}
          />
          <ImpactLine
            label="Affected competencies"
            value={impact ? String(impact.competencyCount) : "0"}
          />
          <ImpactLine
            label="IDP milestones"
            value={impact ? String(impact.milestoneCount) : "0"}
          />
          <ImpactLine
            label="Affected IDPs"
            value={impact ? String(impact.idpCount) : "0"}
          />
          <ImpactLine
            label="Affected employees"
            value={impact ? String(impact.employeeCount) : "0"}
          />
          <ImpactLine
            label="OJT catalogue"
            value={impact ? String(impact.ojtCatalogueCount) : "0"}
          />
          <ImpactLine
            label="eLearning catalogue"
            value={impact ? String(impact.elearningCatalogueCount) : "0"}
          />
          <p className="border-t border-slate-200 pt-3 text-xs text-slate-500">
            Counts use the same authenticated Supabase client and RLS posture
            as the page. No privileged admin reads are used.
          </p>
          {impactError ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {impactError}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-200 bg-white">
          <CardTitle className="text-base">Open decisions</CardTitle>
          <CardDescription>
            Deferred until the framework change model is finalised.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 p-5 text-sm text-slate-700">
          <p>Normalize proficiency levels after the JSONB MVP?</p>
          <p>Add draft framework versions and publish approvals?</p>
          <p>How should published changes affect active IDPs?</p>
        </CardContent>
      </Card>
    </aside>
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
  tone?: "slate" | "blue" | "green" | "amber" | "red"
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

function ImpactLine({
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

function EmptyCompetencyState(): JSX.Element {
  return (
    <CardContent className="flex min-h-[20rem] flex-col items-center justify-center p-8 text-center text-sm text-slate-600">
      <span className="rounded-md bg-slate-100 p-3 text-slate-500">
        <ListTree className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="mt-3 font-medium text-slate-950">No competency selected</p>
      <p className="mt-1 max-w-xs text-slate-500">
        Pick a node from the taxonomy tree to inspect or edit its definition,
        category, and proficiency levels.
      </p>
    </CardContent>
  )
}

function FrameworkErrorState({
  reason,
  detail,
}: {
  reason: LoaderFailureReason
  detail?: string
}): JSX.Element {
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Cannot load framework editor</CardTitle>
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
      return "You need to sign in before viewing the framework editor."
    case "profile_not_found":
      return "Your user profile could not be found."
    case "employee_not_found":
      return "Your user profile is not linked to an employee record."
    case "not_found":
      return "No active competency framework is visible for this tenant."
    case "query_error":
      return "The database returned an unexpected error."
  }
}

function categoryBadgeClass(
  category: CompetencyNode["category"],
): string {
  switch (category) {
    case "technical":
      return "bg-blue-100 text-blue-800"
    case "behavioural":
      return "bg-emerald-100 text-emerald-800"
    case "knowledge":
      return "bg-amber-100 text-amber-800"
    default:
      return "bg-slate-100 text-slate-700"
  }
}

function metricAccentClass(
  tone: "slate" | "blue" | "green" | "amber" | "red",
): string {
  switch (tone) {
    case "blue":
      return "bg-blue-500"
    case "green":
      return "bg-emerald-500"
    case "amber":
      return "bg-amber-500"
    case "red":
      return "bg-red-500"
    default:
      return "bg-slate-900"
  }
}

function metricToneClass(
  tone: "slate" | "blue" | "green" | "amber" | "red",
): string {
  switch (tone) {
    case "blue":
      return "text-blue-700"
    case "green":
      return "text-emerald-700"
    case "amber":
      return "text-amber-700"
    case "red":
      return "text-red-700"
    default:
      return "text-slate-950"
  }
}

function metricIconClass(
  tone: "slate" | "blue" | "green" | "amber" | "red",
): string {
  switch (tone) {
    case "blue":
      return "bg-blue-100 text-blue-700"
    case "green":
      return "bg-emerald-100 text-emerald-700"
    case "amber":
      return "bg-amber-100 text-amber-700"
    case "red":
      return "bg-red-100 text-red-700"
    default:
      return "bg-slate-100 text-slate-700"
  }
}
