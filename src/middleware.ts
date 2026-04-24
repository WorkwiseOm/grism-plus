/**
 * Auth middleware.
 *
 * Slice 1 (committed):
 *   - Static asset bypass via matcher
 *   - Redirect unauthenticated requests on protected routes to /auth/sign-in
 *   - Redirect authenticated requests hitting /auth/sign-in back to /
 *
 * Slice 2 adds:
 *   - Idle timeout enforcement (this file)
 *
 * Slice 2 still to land in the same session:
 *   - Login rate limit (sign-in POST only) — next commit
 *   - MFA enforcement (ld_admin / superadmin) — next commit
 */

import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

type IdleCheckResult = {
  idle_expired: boolean
  last_activity_updated: boolean
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  // FUTURE (next commit in this slice — login rate limit):
  //   For POST requests to /auth/sign-in, call
  //     supabase.rpc('check_login_rate_limit', { p_ip: ipFromHeaders(request) })
  //   using the Vercel-trusted X-Real-IP header. If false, return 429 and
  //   write a login_rate_limited security_events row via admin client.

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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isAuthRoute = pathname.startsWith("/auth/")

  // Idle timeout check + throttled activity refresh in one RPC round-trip.
  // Only runs for authenticated users on non-auth routes — we want the
  // idle-expired user to be able to reach /auth/sign-in afterwards.
  if (user && !isAuthRoute) {
    const { data: rawIdle } = await supabase.rpc(
      "check_and_refresh_idle_timeout",
      {},
    )
    const idleCheck = rawIdle as IdleCheckResult | null

    if (idleCheck?.idle_expired === true) {
      // Revoke the session server-side; setAll callback clears the cookies
      // onto supabaseResponse.
      await supabase.auth.signOut()

      // Audit trail for the expiry. Uses the admin client (service role)
      // because security_events has no client-facing write policy.
      const admin = createAdminClient()
      await admin.from("security_events").insert({
        user_id: user.id,
        event_type: "session_expired",
        ip_address: request.headers.get("x-real-ip"),
        user_agent: request.headers.get("user-agent"),
        metadata: { reason: "idle_timeout" },
      })

      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = "/auth/sign-in"
      redirectUrl.search = ""
      redirectUrl.searchParams.set("reason", "idle_timeout")

      const redirectResponse = NextResponse.redirect(redirectUrl)
      // Carry the cleared cookies from supabaseResponse across to the
      // redirect response so the browser drops the old auth cookies.
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
  if (!user && !isAuthRoute) {
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
