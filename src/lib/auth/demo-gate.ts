/**
 * Application-level passcode gate for the deployed demo path.
 *
 * The deployed demo persona switcher needs a network-layer protection
 * because Vercel Pro plans do not include Deployment Protection on
 * production aliases. This module provides that protection in the app:
 *
 *   - Operator sets DEMO_GATE_PASSCODE in Vercel production env.
 *   - Middleware redirects any request to /demo-gate when both
 *     DEMO_AUTH_RELAXED and DEMO_AUTH_DEPLOYED_BEHIND_PROTECTION are
 *     "true" AND the request lacks a valid demo_gate cookie.
 *   - /demo-gate accepts the passcode, signs a cookie via HMAC-SHA256
 *     using a derived key (HMAC_SESSION_KEY domain-separated by a
 *     fixed label), and lets the user through.
 *
 * This module uses the Web Crypto API (`globalThis.crypto.subtle`) so
 * it works in both the Node runtime (route handlers, server actions)
 * and the Edge runtime (middleware).
 */

const DEMO_GATE_KEY_LABEL = "demo-gate-cookie-v1"
const DEMO_GATE_COOKIE_NAME = "demo_gate"
const DEMO_GATE_TOKEN_VERSION = "v1"
const DEMO_GATE_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60 // 7 days

export const DEMO_GATE = {
  cookieName: DEMO_GATE_COOKIE_NAME,
  maxAgeSeconds: DEMO_GATE_COOKIE_MAX_AGE_SECONDS,
} as const

/**
 * Returns true when both DEMO_AUTH_RELAXED and
 * DEMO_AUTH_DEPLOYED_BEHIND_PROTECTION are exactly "true". This is the
 * env-level switch that turns the gate on; pair with a non-loopback
 * host check (isDemoAuthRelaxedFromEnv) at call sites that need it.
 */
export function isDeployedDemoGateEnabledFromEnv(): boolean {
  return (
    process.env.DEMO_AUTH_RELAXED === "true" &&
    process.env.DEMO_AUTH_DEPLOYED_BEHIND_PROTECTION === "true"
  )
}

let cachedKeyPromise: Promise<CryptoKey> | null = null
let cachedKeySource: string | null = null

async function getSigningKey(): Promise<CryptoKey> {
  const root = process.env.HMAC_SESSION_KEY
  if (!root) {
    throw new Error("HMAC_SESSION_KEY is not set")
  }
  // Reset cache if the env value rotated mid-process (e.g. tests).
  if (cachedKeySource !== root) {
    cachedKeySource = root
    cachedKeyPromise = (async () => {
      const rootKey = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(root),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      )
      const derived = await crypto.subtle.sign(
        "HMAC",
        rootKey,
        new TextEncoder().encode(DEMO_GATE_KEY_LABEL),
      )
      return crypto.subtle.importKey(
        "raw",
        derived,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"],
      )
    })()
  }
  return cachedKeyPromise!
}

function bytesToHex(buf: ArrayBuffer): string {
  const view = new Uint8Array(buf)
  let out = ""
  for (let i = 0; i < view.length; i++) {
    out += view[i].toString(16).padStart(2, "0")
  }
  return out
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> | null {
  if (hex.length % 2 !== 0) return null
  // new Uint8Array(N) creates a fresh ArrayBuffer (not SharedArrayBuffer),
  // but TS 5.7+ infers the wider Uint8Array<ArrayBufferLike> here. The
  // explicit return type narrows it so crypto.subtle.verify's BufferSource
  // parameter accepts the result without a runtime cast.
  const buffer = new ArrayBuffer(hex.length / 2)
  const out = new Uint8Array(buffer)
  for (let i = 0; i < out.length; i++) {
    const byte = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    if (Number.isNaN(byte)) return null
    out[i] = byte
  }
  return out
}

/**
 * Sign a cookie value carrying the current timestamp. Returned string
 * goes directly into the Set-Cookie header value.
 */
export async function signDemoGateCookie(
  now: number = Date.now(),
): Promise<string> {
  const payload = `${DEMO_GATE_TOKEN_VERSION}:${now}`
  const key = await getSigningKey()
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  )
  return `${payload}.${bytesToHex(sig)}`
}

/**
 * Verify a cookie value: HMAC matches AND the embedded timestamp is
 * within DEMO_GATE_COOKIE_MAX_AGE_SECONDS. Returns false on any
 * malformed input rather than throwing — middleware should treat
 * "invalid" and "missing" identically.
 */
export async function verifyDemoGateCookie(
  value: string | undefined,
  now: number = Date.now(),
): Promise<boolean> {
  if (!value || typeof value !== "string") return false
  const lastDot = value.lastIndexOf(".")
  if (lastDot < 1) return false
  const payload = value.slice(0, lastDot)
  const sigHex = value.slice(lastDot + 1)
  const sigBytes = hexToBytes(sigHex)
  if (!sigBytes) return false

  const colon = payload.indexOf(":")
  if (colon < 1) return false
  const version = payload.slice(0, colon)
  if (version !== DEMO_GATE_TOKEN_VERSION) return false
  const issuedAt = Number(payload.slice(colon + 1))
  if (!Number.isFinite(issuedAt) || issuedAt <= 0) return false

  const ageMs = now - issuedAt
  if (ageMs < 0) return false
  if (ageMs > DEMO_GATE_COOKIE_MAX_AGE_SECONDS * 1000) return false

  let key: CryptoKey
  try {
    key = await getSigningKey()
  } catch {
    return false
  }
  try {
    return await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      new TextEncoder().encode(payload),
    )
  } catch {
    return false
  }
}

/**
 * Constant-time compare of an operator-supplied passcode against the
 * configured DEMO_GATE_PASSCODE env value. Returns false if the env
 * is unset, so a missing passcode env never silently allows access.
 */
export function passcodeMatches(input: unknown): boolean {
  if (typeof input !== "string") return false
  const expected = process.env.DEMO_GATE_PASSCODE
  if (!expected || typeof expected !== "string") return false

  const a = new TextEncoder().encode(input)
  const b = new TextEncoder().encode(expected)
  if (a.length !== b.length) return false

  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a[i] ^ b[i]
  }
  return mismatch === 0
}

/**
 * Sanitize a `next` URL parameter: must start with a single "/" so it
 * cannot redirect off-origin (//evil.com) or to a non-path scheme
 * (mailto:, javascript:). Falls back to "/" if invalid or if the
 * target is /demo-gate itself (would loop).
 */
export function sanitizeNextPath(value: unknown): string {
  if (typeof value !== "string") return "/"
  if (value.length === 0 || value.length > 512) return "/"
  if (!value.startsWith("/")) return "/"
  if (value.startsWith("//")) return "/"
  if (value.startsWith("/\\")) return "/"
  if (value.startsWith("/demo-gate")) return "/"
  return value
}
