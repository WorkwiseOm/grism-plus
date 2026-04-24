/**
 * POST /api/auth/mfa/event
 *
 * Authenticated-only endpoint called by the MFA client pages after a
 * successful enrol / challenge_success / challenge_failure to persist
 * the corresponding security_events row. Writes go via the admin
 * (service-role) client — security_events has no client-facing write
 * policy.
 *
 * Accepts { type: 'mfa_enrolled' | 'mfa_challenge_success' | 'mfa_challenge_failure' }.
 * Any other type is rejected with 400.
 */

import { NextResponse, type NextRequest } from "next/server"
import { cookies, headers } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createAdminClient } from "@/lib/supabase/admin"

const ALLOWED_TYPES = [
  "mfa_enrolled",
  "mfa_challenge_success",
  "mfa_challenge_failure",
] as const
type AllowedType = (typeof ALLOWED_TYPES)[number]

type EventBody = {
  type?: string
}

function isAllowedType(value: string | undefined): value is AllowedType {
  return ALLOWED_TYPES.includes(value as AllowedType)
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
  let body: EventBody
  try {
    body = (await request.json()) as EventBody
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    )
  }
  if (!isAllowedType(body.type)) {
    return NextResponse.json(
      { error: "Invalid event type." },
      { status: 400 },
    )
  }

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
            // Defensive; cookies are mutable in route handlers.
          }
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated." }, { status: 401 })
  }

  const headerStore = headers()
  const admin = createAdminClient()
  await admin.from("security_events").insert({
    user_id: user.id,
    event_type: body.type,
    ip_address: ipFromRequest(request),
    user_agent: headerStore.get("user-agent"),
    metadata: null,
  })

  return NextResponse.json({ ok: true }, { status: 200 })
}
