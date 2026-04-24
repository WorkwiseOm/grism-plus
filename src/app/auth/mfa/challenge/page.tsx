"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createClient } from "@/lib/supabase/client"

type ChallengeState =
  | { status: "loading" }
  | { status: "ready"; factorId: string }
  | { status: "error"; message: string }

export default function ChallengePage() {
  const router = useRouter()
  const [state, setState] = useState<ChallengeState>({ status: "loading" })
  const [code, setCode] = useState("")
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function init(): Promise<void> {
      const supabase = createClient()
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (cancelled) return
      if (error) {
        setState({ status: "error", message: error.message })
        return
      }
      const verified = data?.totp?.find((f) => f.status === "verified")
      if (!verified) {
        // No verified factor — bounce back through / so middleware can
        // redirect to /auth/mfa/enrol. Self-healing fallback.
        router.push("/")
        return
      }
      setState({ status: "ready", factorId: verified.id })
    }
    init()
    return () => {
      cancelled = true
    }
  }, [router])

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault()
    if (state.status !== "ready") return
    setSubmitError(null)
    setSubmitting(true)

    const supabase = createClient()

    // Per-user rate limit check before we attempt verify. On a rate-limit
    // hit, bounce the user out of the MFA flow entirely — they have to
    // re-authenticate before trying again (rate limit persists 15 min).
    const { data: allowed } = await supabase.rpc("check_mfa_rate_limit")
    if (allowed === false) {
      router.push("/auth/sign-in?reason=mfa_locked")
      return
    }

    // Fresh challenge each submit — challenges are single-use and TTL'd.
    const { data: challenge, error: challengeErr } =
      await supabase.auth.mfa.challenge({ factorId: state.factorId })
    if (challengeErr || !challenge) {
      setSubmitError(challengeErr?.message ?? "Failed to start challenge.")
      setSubmitting(false)
      return
    }

    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId: state.factorId,
      challengeId: challenge.id,
      code,
    })

    if (verifyErr) {
      await fetch("/api/auth/mfa/event", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "mfa_challenge_failure" }),
      })
      setSubmitError(verifyErr.message)
      setSubmitting(false)
      return
    }

    await fetch("/api/auth/mfa/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "mfa_challenge_success" }),
    })
    setSubmitting(false)
    router.push("/")
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Two-factor verification</CardTitle>
          <CardDescription>
            Enter the 6-digit code from your authenticator app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {state.status === "loading" && (
            <p className="text-sm text-slate-600">Preparing challenge…</p>
          )}
          {state.status === "error" && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          )}
          {state.status === "ready" && (
            <form onSubmit={handleSubmit} className="space-y-3" noValidate>
              <div className="space-y-2">
                <Label htmlFor="code">6-digit code</Label>
                <Input
                  id="code"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                  required
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  disabled={submitting}
                />
              </div>
              {submitError && (
                <Alert variant="destructive" role="alert">
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={submitting || code.length !== 6}
              >
                {submitting ? "Verifying…" : "Verify"}
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-xs text-slate-600">
            Lost access to your device? Contact your L&amp;D administrator.
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
