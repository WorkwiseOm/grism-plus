"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import {
  DEMO_GATE,
  isDeployedDemoGateEnabledFromEnv,
  passcodeMatches,
  sanitizeNextPath,
  signDemoGateCookie,
} from "@/lib/auth/demo-gate"

export type DemoGateActionState = {
  error?: string
}

export async function submitDemoGate(
  _prevState: DemoGateActionState,
  formData: FormData,
): Promise<DemoGateActionState> {
  // Re-check the gate at submit time so a stale page rendered while
  // the deployed demo path was open cannot be replayed against an
  // env that has since closed it.
  if (!isDeployedDemoGateEnabledFromEnv()) {
    return { error: "Demo gate is not enabled in this environment." }
  }

  const passcode = formData.get("passcode")
  if (!passcodeMatches(passcode)) {
    return { error: "Incorrect passcode." }
  }

  const cookie = await signDemoGateCookie()
  const cookieStore = await cookies()
  cookieStore.set(DEMO_GATE.cookieName, cookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DEMO_GATE.maxAgeSeconds,
  })

  const next = sanitizeNextPath(formData.get("next"))
  redirect(next)
}
