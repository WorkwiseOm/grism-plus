"use client"

import {
  useEffect,
  useState,
  type FormEvent,
} from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createClient } from "@/lib/supabase/client"

type EnrolState =
  | { status: "loading" }
  | {
      status: "ready"
      factorId: string
      qrCode: string
      secret: string
    }
  | { status: "error"; message: string }

export default function EnrolPage() {
  const router = useRouter()
  const [state, setState] = useState<EnrolState>({ status: "loading" })
  const [code, setCode] = useState("")
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function initEnrol(): Promise<void> {
      const supabase = createClient()
      const { data: factorsData, error: factorsError } =
        await supabase.auth.mfa.listFactors()

      if (cancelled) return
      if (factorsError) {
        setState({ status: "error", message: factorsError.message })
        return
      }

      const hasVerifiedTotp =
        factorsData?.totp?.some((factor) => factor.status === "verified") ??
        false
      if (hasVerifiedTotp) {
        router.replace("/auth/mfa/challenge")
        return
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Grism Plus ${Date.now()}`,
      })
      if (cancelled) return
      if (error) {
        setState({ status: "error", message: error.message })
        return
      }
      if (!data?.totp) {
        setState({
          status: "error",
          message: "Enrolment did not return TOTP data.",
        })
        return
      }
      setState({
        status: "ready",
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      })
    }
    initEnrol()
    return () => {
      cancelled = true
    }
  }, [router])

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (state.status !== "ready") return
    setSubmitError(null)
    setSubmitting(true)

    const supabase = createClient()
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
      setSubmitError(verifyErr.message)
      setSubmitting(false)
      return
    }

    await fetch("/api/auth/mfa/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "mfa_enrolled" }),
    })
    setSubmitting(false)
    router.push("/")
    router.refresh()
  }

  async function handleCopy(): Promise<void> {
    if (state.status !== "ready") return
    try {
      await navigator.clipboard.writeText(state.secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard may be unavailable; the user can still copy manually.
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Enable two-factor authentication</CardTitle>
          <CardDescription>
            Your role requires two-factor authentication. Scan the QR code below with your authenticator app, then enter the 6-digit code to confirm.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {state.status === "loading" && (
            <p className="text-sm text-slate-600">Generating enrolment…</p>
          )}
          {state.status === "error" && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          )}
          {state.status === "ready" && (
            <>
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={state.qrCode}
                  alt="Scan with your authenticator app"
                  className="h-48 w-48"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-600">
                  Can&apos;t scan? Enter this code manually:
                </Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all rounded-md bg-slate-100 px-2 py-1 font-mono text-xs">
                    {state.secret}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                  >
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-slate-600">
                Works with Google Authenticator, 1Password, Authy, Bitwarden, and other TOTP-compatible apps.
              </p>
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
                  {submitting ? "Verifying…" : "Confirm"}
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
