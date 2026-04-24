/**
 * Auth middleware.
 *
 * Slice 1: static asset bypass (via matcher), unauthenticated → sign-in,
 * authenticated hitting sign-in → root.
 * Slice 2 adds: login rate limit on POST /api/auth/sign-in, idle timeout
 * enforcement with throttled activity refresh, session_expired audit on
 * idle expiry, login_rate_limited audit on rate-limit block.
 *
 * Slice 2 still to land: MFA enforcement redirect.
 */

import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

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

  // Login rate limit — only for POST /api/auth/sign-in. Runs as anon
  // against the RPC (check_login_rate_limit is GRANTed to anon). On a
  // rate-limit hit we write the login_rate_limited event via the admin
  // client and short-circuit with 429; the actual sign-in handler does
  // not run.
  if (
    request.method === "POST" &&
    pathname === "/api/auth/sign-in"
  ) {
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Idle timeout check + throttled activity refresh. Only runs for
  // authenticated users on non-auth routes so idle-expired users can
  // still reach /auth/sign-in after we redirect them.
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

  // FUTURE (next commit in this slice — MFA enforcement):
  //   if (user && !isAuthRoute) {
  //     const { data: mfaRequired } = await supabase.rpc('user_mfa_required_but_missing')
  //     if (mfaRequired === true) {
  //       const { data: factors } = await supabase.auth.mfa.listFactors()
  //       const hasVerified = factors?.totp?.some(f => f.status === 'verified')
  //       return redirect(hasVerified ? '/auth/mfa/challenge' : '/auth/mfa/enrol')
  //     }
  //   }

  // Unauthenticated request to a protected route → send to sign-in.
  if (!user && !isAuthRoute && !pathname.startsWith("/api/auth/")) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/sign-in"
    return NextResponse.redirect(url)
  }

  // Authenticated request hitting /auth/sign-in → send home; the root
  // page.tsx handles role-based routing from there.
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
