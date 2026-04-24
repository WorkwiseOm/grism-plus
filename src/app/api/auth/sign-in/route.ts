/**
 * POST /api/auth/sign-in
 *
 * Server-side sign-in endpoint. Replaces the direct browser →
 * supabase.auth.signInWithPassword() call so the flow passes through our
 * server, which lets the middleware apply a rate limit (see
 * src/middleware.ts) and lets us write login_success / login_failure
 * rows to security_events via the admin client.
 *
 * The middleware handles the rate-limit pre-check for this path and
 * short-circuits with 429 + login_rate_limited if the limit is hit, so
 * this handler only ever runs for allowed attempts.
 *
 * Session cookie propagation: createServerClient's setAll callback
 * writes into Next.js cookies(), which are attached to the response
 * automatically. Browser stores them; subsequent requests are
 * authenticated.
 */

import { NextResponse, type NextRequest } from "next/server"
import { cookies, headers } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createAdminClient } from "@/lib/supabase/admin"

type SignInBody = {
  email?: string
  password?: string
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
  let body: SignInBody
  try {
    body = (await request.json()) as SignInBody
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    )
  }
  const { email, password } = body
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    )
  }

  const headerStore = headers()
  const ip = ipFromRequest(request)
  const userAgent = headerStore.get("user-agent")

  const cookieStore = cookies()
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
            // Route handlers have mutable cookies; this catch is
            // defensive for any unforeseen runtime quirk.
          }
        },
      },
    },
  )

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  const admin = createAdminClient()

  if (error || !data.user) {
    await admin.from("security_events").insert({
      user_id: null,
      event_type: "login_failure",
      ip_address: ip,
      user_agent: userAgent,
      metadata: { email, reason: error?.message ?? "unknown" },
    })
    return NextResponse.json(
      { error: error?.message ?? "Sign-in failed." },
      { status: 401 },
    )
  }

  await admin.from("security_events").insert({
    user_id: data.user.id,
    event_type: "login_success",
    ip_address: ip,
    user_agent: userAgent,
    metadata: null,
  })

  return NextResponse.json({ ok: true }, { status: 200 })
}
