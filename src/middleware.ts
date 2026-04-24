/**
 * Auth middleware (Step 4 slice 1).
 *
 * Scope in this slice:
 *   1. Static asset bypass via matcher
 *   2. Redirect unauthenticated requests on protected routes to /auth/sign-in
 *   3. Redirect authenticated requests hitting /auth/sign-in back to /
 *
 * Deferred to slice 2: rate limiting, MFA enforcement, idle timeout,
 * security_events writes. See FUTURE markers below for plug-in points.
 */

import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest): Promise<NextResponse> {
  // FUTURE (slice 2 — rate limit):
  //   For POST requests to /auth/sign-in, call
  //     supabase.rpc('check_login_rate_limit', { p_ip: ipFromHeaders(request) })
  //   using the Vercel-trusted X-Real-IP header. If false, return 429 and
  //   write a login_rate_limited security_events row via admin client
  //   (createAdminClient from src/lib/supabase/admin.ts). Corresponding
  //   function + index + enum value live in migrations 00003 and 00004.

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

  // FUTURE (slice 2 — MFA enforcement):
  //   if (user && !isAuthRoute) {
  //     const { data: mfaRequired } = await supabase.rpc('user_mfa_required_but_missing')
  //     if (mfaRequired === true) {
  //       const { data: factors } = await supabase.auth.mfa.listFactors()
  //       const hasVerified = factors?.totp?.some(f => f.status === 'verified')
  //       return redirect(hasVerified ? '/auth/mfa/challenge' : '/auth/mfa/enrol')
  //     }
  //   }
  //   Function lives in migration 00004.

  // FUTURE (slice 2 — idle timeout):
  //   if (user) {
  //     const { data } = await supabase.from('user_profiles')
  //       .select('last_activity_at, tenant_id, tenants!inner(idle_timeout_minutes)')
  //       .eq('id', user.id).single()
  //     if (isIdle(data)) { signOut + redirect to /auth/sign-in }
  //     else { throttled update of last_activity_at via admin client }
  //   }
  //   Column added in migration 00006.

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
