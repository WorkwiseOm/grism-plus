import Link from "next/link"
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
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          L&amp;D workspace
        </p>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              Framework editor
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Edit the active framework taxonomy for the current tenant.
              Publishing, version history, and draft branches remain deferred
              until the framework change model is finalized.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button form="competency-edit-form" type="submit" disabled={!selected}>
              Save node
            </Button>
            <Button variant="outline" disabled>
              Publish taxonomy
            </Button>
          </div>
        </div>
      </header>

      <FrameworkStatusBanner error={error} updated={updated} />

      <FrameworkOverview tree={tree.data} />

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)_320px]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-slate-200">
            <CardTitle className="text-base">Taxonomy tree</CardTitle>
            <CardDescription>
              {tree.data.framework.name} · v{tree.data.framework.version}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {tree.data.roots.length > 0 ? (
              <div className="divide-y divide-slate-100">
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

        <Card>
          {selected ? (
            <SelectedCompetency node={selected} />
          ) : (
            <EmptyCompetencyState />
          )}
        </Card>

        <ImpactPanel
          node={selected}
          impact={impact?.ok ? impact.data : null}
          impactError={impact && !impact.ok ? loaderReasonMessage(impact.reason) : null}
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
      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        Competency saved.
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {competencyEditErrorMessage(error)}
      </div>
    )
  }

  return null
}

function FrameworkOverview({ tree }: { tree: FrameworkTree }): JSX.Element {
  const stats = buildFrameworkStats(tree)
  return (
    <section className="grid gap-3 md:grid-cols-5">
      <MetricCard label="Competencies" value={stats.totalCompetencies} />
      <MetricCard label="Root nodes" value={stats.rootCount} />
      <MetricCard label="Technical" value={stats.technical} tone="blue" />
      <MetricCard label="Behavioural" value={stats.behavioural} tone="green" />
      <MetricCard label="Knowledge" value={stats.knowledge} tone="amber" />
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
  return (
    <>
      <CardHeader className="border-b border-slate-200">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-xl">{node.name}</CardTitle>
            <CardDescription className="mt-1">
              {node.code} · {categoryLabel(node.category)}
            </CardDescription>
          </div>
          <span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
            {countDescendants(node)} descendant{countDescendants(node) === 1 ? "" : "s"}
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

          <section className="rounded-lg border border-dashed border-slate-300 p-4">
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
    <aside className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Impact analysis</CardTitle>
          <CardDescription>Read-only for active IDP impact.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Open decisions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-700">
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
  tone = "slate",
}: {
  label: string
  value: number
  tone?: "slate" | "blue" | "green" | "amber"
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
    <>
      <CardHeader>
        <CardTitle className="text-base">No competency selected</CardTitle>
        <CardDescription>
          Select a node from the taxonomy tree to inspect it.
        </CardDescription>
      </CardHeader>
    </>
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

function metricToneClass(tone: "slate" | "blue" | "green" | "amber"): string {
  switch (tone) {
    case "blue":
      return "text-blue-700"
    case "green":
      return "text-emerald-700"
    case "amber":
      return "text-amber-700"
    default:
      return "text-slate-950"
  }
}
