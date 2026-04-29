import { Suspense } from "react"
import { headers } from "next/headers"

import { isDemoAuthRelaxedFromEnv } from "@/lib/auth/demo-mode"
import { availableDemoPersonas } from "@/lib/auth/demo-personas"
import { SignInForm } from "./_sign-in-form"
import { DemoPersonaSwitcher } from "./_demo-switcher"

export default async function SignInPage(): Promise<JSX.Element> {
  const requestHeaders = await headers()
  const showDemoSwitcher = isDemoAuthRelaxedFromEnv(requestHeaders.get("host"))
  const personas = showDemoSwitcher ? availableDemoPersonas() : []

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-4">
      <Suspense fallback={null}>
        <SignInForm />
      </Suspense>
      {showDemoSwitcher ? <DemoPersonaSwitcher personas={personas} /> : null}
    </div>
  )
}
