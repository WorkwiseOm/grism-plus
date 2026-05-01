import { notFound } from "next/navigation"

import {
  isDeployedDemoGateEnabledFromEnv,
  sanitizeNextPath,
} from "@/lib/auth/demo-gate"
import { DemoGateForm } from "@/app/demo-gate/_form"

type SearchParams = { [key: string]: string | string[] | undefined }

export default async function DemoGatePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}): Promise<JSX.Element> {
  // The page only exists when the deployed demo path is enabled. In
  // any other environment (local dev without the deployed flag, or a
  // production deploy where the operator hasn't opted in), the route
  // 404s. This keeps the surface area small for environments that
  // never need it.
  if (!isDeployedDemoGateEnabledFromEnv()) {
    notFound()
  }

  const params = await searchParams
  const next = sanitizeNextPath(params.next)

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">
          Demo access
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Enter the passcode to continue. This deployment runs against
          the development Supabase project; do not enter real customer
          data.
        </p>
        <div className="mt-4">
          <DemoGateForm next={next} />
        </div>
      </div>
    </main>
  )
}
