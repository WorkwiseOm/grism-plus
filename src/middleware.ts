/**
 * Auth middleware.
 *
 * Chain order (each guard may short-circuit with a redirect/429 before
 * the next runs):
 *
 *   1. Supabase SSR client + session cookie refresh
 *   2. Login rate limit — POST /api/auth/sign-in only
 *   3. getUser() → session resolved
 *   4. Idle timeout check + throttled last_activity_at refresh
 *      (authenticated users on non-auth routes)
 *   5. MFA enforcement: role in tenants.mfa_required_roles + aal1
 *      → redirect to /auth/mfa/challenge (factor verified) or
 *        /auth/mfa/enrol (no verified factor yet)
 *   6. Unauthenticated → /auth/sign-in (allowlist: /auth/sign-in,
 *      /api/auth/*)
 *   7. Authenticated hitting /auth/sign-in → /
 *
 * Invariants:
 *   - /auth/mfa/* pages require auth context; unauth hits bounce to
 *     /auth/sign-in via rule 6.
 *   - /auth/mfa/* is exempt from rule 5 (the pages ARE the target of
 *     the redirect — running MFA enforcement there would loop).
 *   - /api/auth/* is exempt from rules 5 and 6 so pre-auth endpoints
 *     (sign-in) and authenticated event-writing endpoints stay
 *     reachable.
 *
 * Loop audit (scenario map):
 *   A. unauth → /            → 307 /auth/sign-in → pass
 *   B. unauth → /auth/mfa/*  → 307 /auth/sign-in → pass
 *   C. unauth → POST /api/auth/sign-in → rate-limit gate → handler
 *   D. aal1 ld_admin → /     → MFA check → 307 /auth/mfa/enrol → pass
 *   E. aal1 ld_admin → /auth/mfa/enrol → rule 5 skipped → page renders
 *   F. aal2 ld_admin → /     → MFA check false → root page → /admin
 *   G. aal1 employee → /     → MFA check false → root page → /employee
 *   H. authed → /api/auth/mfa/event → rule 5 skipped → handler
 *   J. authed → /auth/sign-in → 307 / → Scenario D or F (no loop)
 */

import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isDemoAuthRelaxedFromEnv } from "@/lib/auth/demo-mode"

type IdleCheckResult = {
  idle_expired: boolean
  last_activity_updated: boolean
}

function ipFromRequest(request: NextRequest): string | null {
  const h = request.headers
  return (
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  )
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const pathname = request.nextUrl.pathname
  const isAuthRoute = pathname.startsWith("/auth/")
  const isApiRoute = pathname.startsWith("/api/")

  // 2. Login rate limit. Applied only to POST /api/auth/sign-in.
  if (request.method === "POST" && pathname === "/api/auth/sign-in") {
    const ip = ipFromRequest(request)
    if (ip) {
      const { data: allowed } = await supabase.rpc(
        "check_login_rate_limit",
        { p_ip: ip },
      )
      if (allowed === false) {
        const admin = createAdminClient()
        await admin.from("security_events").insert({
          user_id: null,
          event_type: "login_rate_limited",
          ip_address: ip,
          user_agent: request.headers.get("user-agent"),
          metadata: null,
        })
        return NextResponse.json(
          {
            error:
              "Too many sign-in attempts from this IP. Try again in 15 minutes.",
          },
          { status: 429 },
        )
      }
    }
  }

  // 3. Resolve session.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 4. Idle timeout check (authenticated, non-auth routes only).
  if (user && !isAuthRoute) {
    const { data: rawIdle } = await supabase.rpc(
      "check_and_refresh_idle_timeout",
      {},
    )
    const idleCheck = rawIdle as IdleCheckResult | null

    if (idleCheck?.idle_expired === true) {
      await supabase.auth.signOut()

      const admin = createAdminClient()
      await admin.from("security_events").insert({
        user_id: user.id,
        event_type: "session_expired",
        ip_address: ipFromRequest(request),
        user_agent: request.headers.get("user-agent"),
        metadata: { reason: "idle_timeout" },
      })

      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = "/auth/sign-in"
      redirectUrl.search = ""
      redirectUrl.searchParams.set("reason", "idle_timeout")

      const redirectResponse = NextResponse.redirect(redirectUrl)
      supabaseResponse.cookies
        .getAll()
        .forEach((c) => redirectResponse.cookies.set(c))
      return redirectResponse
    }
  }

  // 5. MFA enforcement. Skipped on auth routes (so /auth/mfa/* pages
  // are reachable as the target) and on /api/* routes (so the event
  // endpoint and future auth API routes stay reachable). The RPC
  // returns true only when the user's role is in their tenant's
  // mfa_required_roles AND current AAL is aal1.
  //
  // Local demo mode also bypasses this branch so reviewers can switch
  // into ld_admin / superadmin personas without a TOTP enrolment loop.
  // Triple-gated by isDemoAuthRelaxedFromEnv: NODE_ENV != "production",
  // DEMO_AUTH_RELAXED == "true", and Host is loopback. All three must
  // hold; otherwise normal MFA enforcement runs unchanged.
  const demoRelaxed = isDemoAuthRelaxedFromEnv(request.headers.get("host"))
  if (user && !isAuthRoute && !isApiRoute && !demoRelaxed) {
    const { data: rawMfaRequired } = await supabase.rpc(
      "user_mfa_required_but_missing",
    )
    const mfaRequired = rawMfaRequired as boolean | null

    if (mfaRequired === true) {
      const { data: factorsData } = await supabase.auth.mfa.listFactors()
      const hasVerifiedTotp =
        factorsData?.totp?.some((f) => f.status === "verified") ?? false
      const redirectPath = hasVerifiedTotp
        ? "/auth/mfa/challenge"
        : "/auth/mfa/enrol"
      const url = request.nextUrl.clone()
      url.pathname = redirectPath
      url.search = ""
      return NextResponse.redirect(url)
    }
  }

  // 6. Unauthenticated → sign-in. Allowlist is narrow: only
  // /auth/sign-in and /api/auth/*. /auth/mfa/* require an authenticated
  // context and are NOT in the allowlist.
  if (
    !user &&
    pathname !== "/auth/sign-in" &&
    !pathname.startsWith("/api/auth/")
  ) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/sign-in"
    return NextResponse.redirect(url)
  }

  // 7. Authenticated hitting /auth/sign-in → /; root page then
  // role-routes (and MFA rule 5 catches required-MFA users on the
  // next hop).
  if (user && pathname === "/auth/sign-in") {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Run on everything EXCEPT Next.js internals, favicon, and common
    // asset extensions. Keeps the session-refresh cost off static fetches.
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2|ttf|eot)$).*)",
  ],
}
