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
import { getFrameworkTree } from "@/lib/data"
import type { CompetencyNode, FrameworkTree } from "@/lib/data"
import type { LoaderFailureReason } from "@/lib/data"
import {
  buildFrameworkStats,
  categoryLabel,
  countDescendants,
  findCompetencyNode,
  getProficiencyLevelCount,
  getProficiencyLevelLabels,
} from "@/lib/framework-editor/tree"
import { cn } from "@/lib/utils"

type PageProps = {
  searchParams?: Promise<{ competency?: string | string[] }>
}

export default async function AdminFrameworksPage({
  searchParams,
}: PageProps): Promise<JSX.Element> {
  await requireRole(["ld_admin", "superadmin"])

  const params = await searchParams
  const requestedCompetency = Array.isArray(params?.competency)
    ? params?.competency[0]
    : params?.competency

  const tree = await getFrameworkTree()
  if (!tree.ok) {
    return <FrameworkErrorState reason={tree.reason} detail={tree.detail} />
  }

  const selected = findCompetencyNode(tree.data.roots, requestedCompetency)

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
              Inspect the active competency framework and its taxonomy. Editing,
              publishing, and versioning remain disabled until the framework
              change model is decided.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled>Save node</Button>
            <Button variant="outline" disabled>
              Publish taxonomy
            </Button>
          </div>
        </div>
      </header>

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

        <ImpactPanel node={selected} />
      </div>
    </div>
  )
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
      <CardContent className="space-y-6 p-5">
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-sm font-semibold text-slate-950">Definition</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            {node.description ?? "No definition is stored for this competency yet."}
          </p>
        </section>

        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-950">
              Proficiency levels
            </h2>
            <span className="text-xs text-slate-500">
              {getProficiencyLevelCount(node)} stored
            </span>
          </div>
          {levels.length > 0 ? (
            <div className="mt-3 space-y-2">
              {levels.map((level, index) => (
                <div
                  key={`${level}-${index}`}
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-slate-950">
                    L{index + 1}
                  </span>{" "}
                  <span className="text-slate-700">{level}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-600">
              No proficiency level labels are available for this node.
            </p>
          )}
        </section>

        <section className="rounded-lg border border-dashed border-slate-300 p-4">
          <h2 className="text-sm font-semibold text-slate-950">
            Associated learning signals
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            70/20/10 signal mapping and downstream IDP impact analysis will be
            connected after the Phase 1 schema and framework change model are
            verified.
          </p>
        </section>
      </CardContent>
    </>
  )
}

function ImpactPanel({ node }: { node: CompetencyNode | null }): JSX.Element {
  return (
    <aside className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Impact analysis</CardTitle>
          <CardDescription>Read-only until edit flows land.</CardDescription>
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
          <p className="border-t border-slate-200 pt-3 text-xs text-slate-500">
            Active IDP impact counts require a follow-up loader that joins IDP
            milestones against competencies. This screen does not perform extra
            admin-client reads.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Open decisions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-700">
          <p>Keep proficiency levels as JSONB or normalize them?</p>
          <p>Support draft versions in Phase 1 or edit current demo data only?</p>
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
