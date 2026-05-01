"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { DemoPersonaPublic } from "@/lib/auth/demo-personas"

type Props = {
  personas: ReadonlyArray<DemoPersonaPublic>
}

/**
 * Demo persona switcher.
 *
 * Renders only when the parent server component decides the demo gate
 * is open (isDemoAuthRelaxedFromEnv) — either local-loopback dev or a
 * deployed environment behind operator-verified Deployment Protection.
 * The route handler re-checks the gate, so this component cannot be
 * exploited just by being shipped to the client — even if a stale page
 * is replayed against a server with the gate closed, the action rejects.
 *
 * Sends only the persona id to the route handler. The route resolves
 * the password server-side from env, so no demo password is exposed
 * to the browser.
 */
export function DemoPersonaSwitcher({ personas }: Props): JSX.Element | null {
  const router = useRouter()
  const [pendingPersonaId, setPendingPersonaId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (personas.length === 0) return null

  async function signIn(personaId: string): Promise<void> {
    setError(null)
    setPendingPersonaId(personaId)
    let response: Response
    try {
      response = await fetch("/api/auth/demo-sign-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ personaId }),
      })
    } catch {
      setError("Demo sign-in could not reach the local app.")
      setPendingPersonaId(null)
      return
    }

    const data = (await response.json().catch(() => ({}))) as {
      error?: string
      ok?: boolean
    }
    if (!response.ok) {
      setError(data.error ?? "Demo sign-in failed.")
      setPendingPersonaId(null)
      return
    }

    router.push("/")
    router.refresh()
  }

  return (
    <aside
      aria-label="Local demo persona switcher"
      className="w-full max-w-md rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-900"
    >
      <p className="text-xs font-semibold uppercase tracking-wider">
        Demo mode
      </p>
      <p className="mt-1 text-sm">
        Sign in as a seeded demo persona. Bypasses MFA for L&D admin /
        superadmin roles. Available only when the demo gate is opened
        server-side (local loopback, or a deployed environment behind
        verified Deployment Protection).
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {personas.map((p) => (
          <Button
            key={p.id}
            type="button"
            variant="outline"
            suppressHydrationWarning
            className="w-full justify-start border-amber-400 bg-white text-amber-900 hover:bg-amber-100"
            disabled={pendingPersonaId !== null}
            onClick={() => void signIn(p.id)}
          >
            {pendingPersonaId === p.id ? "Signing in..." : p.label}
          </Button>
        ))}
      </div>
      {error && (
        <Alert variant="destructive" role="alert" className="mt-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </aside>
  )
}
