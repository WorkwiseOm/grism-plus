"use client"

import { Button } from "@/components/ui/button"
import { signInAsDemoPersona } from "./actions"
import type { DemoPersonaPublic } from "@/lib/auth/demo-personas"

type Props = {
  personas: ReadonlyArray<DemoPersonaPublic>
}

/**
 * Local-only demo persona switcher.
 *
 * Renders only when the parent server component decides the demo gate
 * is open (isDemoAuthRelaxedFromEnv). The action itself re-checks the
 * gate, so this component cannot be exploited just by being shipped to
 * the client — even if a stale page is replayed against a production
 * server, the action rejects.
 *
 * Each persona is its own form so the click directly submits with the
 * intended personaId; no client-side state, no JS event handler — pure
 * progressive enhancement on top of an HTML form action.
 */
export function DemoPersonaSwitcher({ personas }: Props): JSX.Element | null {
  if (personas.length === 0) return null

  return (
    <aside
      aria-label="Local demo persona switcher"
      className="w-full max-w-md rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-900"
    >
      <p className="text-xs font-semibold uppercase tracking-wider">
        Local demo only
      </p>
      <p className="mt-1 text-sm">
        Sign in as a seeded demo persona. This shortcut is disabled outside
        localhost and requires <code>DEMO_AUTH_RELAXED=true</code>.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {personas.map((p) => (
          <form key={p.id} action={signInAsDemoPersona}>
            <input type="hidden" name="personaId" value={p.id} />
            <Button
              type="submit"
              variant="outline"
              className="w-full justify-start border-amber-400 bg-white text-amber-900 hover:bg-amber-100"
            >
              {p.label}
            </Button>
          </form>
        ))}
      </div>
    </aside>
  )
}
