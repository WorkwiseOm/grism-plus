import { NextResponse, type NextRequest } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

import { isDemoAuthRelaxedFromEnv } from "@/lib/auth/demo-mode"
import { resolveDemoPersona } from "@/lib/auth/demo-personas"
import { createAdminClient } from "@/lib/supabase/admin"

type DemoSignInBody = {
  personaId?: string
}

function ipFromRequest(request: NextRequest): string | null {
  const h = request.headers
  return (
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  )
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isDemoAuthRelaxedFromEnv(request.headers.get("host"))) {
    return NextResponse.json(
      { error: "Demo persona sign-in is not available here." },
      { status: 403 },
    )
  }

  let body: DemoSignInBody
  try {
    body = (await request.json()) as DemoSignInBody
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    )
  }

  const { personaId } = body
  if (!personaId) {
    return NextResponse.json(
      { error: "Choose a demo persona first." },
      { status: 400 },
    )
  }

  const persona = resolveDemoPersona(personaId)
  if (!persona) {
    return NextResponse.json(
      { error: "That demo persona is not configured locally." },
      { status: 400 },
    )
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Route handlers have mutable cookies; this catch is defensive
            // for any unforeseen runtime quirk.
          }
        },
      },
    },
  )

  await supabase.auth.signOut()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: persona.email,
    password: persona.password,
  })

  const admin = createAdminClient()
  const ip = ipFromRequest(request)
  const userAgent = request.headers.get("user-agent")

  if (error || !data.user) {
    await admin.from("security_events").insert({
      user_id: null,
      event_type: "login_failure",
      ip_address: ip,
      user_agent: userAgent,
      metadata: {
        demo_persona_id: personaId,
        reason: error?.message ?? "unknown",
      },
    })
    return NextResponse.json(
      { error: "Demo sign-in failed. The local password may be stale." },
      { status: 401 },
    )
  }

  await admin.from("security_events").insert({
    user_id: data.user.id,
    event_type: "login_success",
    ip_address: ip,
    user_agent: userAgent,
    metadata: { demo_persona_id: personaId },
  })

  await admin
    .from("user_profiles")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", data.user.id)
    .is("deleted_at", null)

  return NextResponse.json({ ok: true }, { status: 200 })
}
