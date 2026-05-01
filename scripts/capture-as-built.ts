/**
 * Capture as-built PNGs of the polished Phase 1 product screens for the
 * design folder. Runs against the local dev server and signs in by POSTing
 * directly to the demo route handler from the page context (no UI click,
 * so React hydration timing is not a factor). The four captures land
 * beside the original Stitch designs in
 * design/stitch-phase1/<screen>/as-built.png.
 *
 * Prerequisites (operator):
 *   1. `npm run dev` must be running on http://localhost:3000.
 *   2. `.env.local` has DEMO_AUTH_RELAXED=true plus the password env
 *      var for each captured persona (Aisha, Khalid, Saif).
 *
 * Run:
 *   npx tsx scripts/capture-as-built.ts
 *
 * Override base URL if the dev server is on a different port:
 *   CAPTURE_BASE_URL=http://localhost:3001 npx tsx scripts/capture-as-built.ts
 *
 * Notes:
 *   - Headless Chromium is downloaded by puppeteer's postinstall. CI sets
 *     PUPPETEER_SKIP_DOWNLOAD=true so it does NOT pull Chromium each run;
 *     this script is local-only.
 *   - The script never prints persona passwords. Authentication runs
 *     entirely through /api/auth/demo-sign-in, which reads the env-stored
 *     password server-side from the persona id sent in the body.
 */
import { mkdir } from "node:fs/promises"
import path from "node:path"
import puppeteer, { type Browser } from "puppeteer"

type CaptureTarget = {
  /** Stable persona id (matches DEMO_PERSONAS in src/lib/auth/demo-personas.ts). */
  personaId: string
  /** Human label, used only for log lines. */
  personaLabel: string
  /** Route to capture after sign-in completes. */
  route: string
  /** Stitch folder to write `as-built.png` into. */
  outDir: string
}

const CAPTURES: ReadonlyArray<CaptureTarget> = [
  {
    personaId: "aisha",
    personaLabel: "Aisha Al-Balushi (L&D admin)",
    route: "/admin/idps",
    outDir: "design/stitch-phase1/l_d_admin_idp_approval_queue",
  },
  {
    personaId: "aisha",
    personaLabel: "Aisha Al-Balushi (L&D admin)",
    route: "/admin/frameworks",
    outDir: "design/stitch-phase1/framework_editor",
  },
  {
    personaId: "khalid",
    personaLabel: "Khalid Al-Harthy (manager)",
    route: "/manager/team",
    outDir: "design/stitch-phase1/manager_team_cockpit",
  },
  {
    personaId: "saif",
    personaLabel: "Saif Al-Habsi (employee)",
    route: "/employee/idp",
    outDir: "design/stitch-phase1/employee_idp_workspace",
  },
]

const BASE_URL = process.env.CAPTURE_BASE_URL ?? "http://localhost:3000"
const VIEWPORT = { width: 1440, height: 900 }
const HYDRATION_PAUSE_MS = 1200

async function preflight(): Promise<void> {
  try {
    const r = await fetch(`${BASE_URL}/auth/sign-in`, { method: "GET" })
    if (!r.ok) {
      throw new Error(`status ${r.status}`)
    }
  } catch (err) {
    throw new Error(
      `Dev server unreachable at ${BASE_URL}. Run \`npm run dev\` first. (${(err as Error).message})`,
    )
  }
}

/**
 * Sign in by calling the demo route handler from the page context. The
 * response's Set-Cookie headers populate the page's cookie jar, so a
 * subsequent navigation is authenticated. Avoids the UI hydration race
 * that bites a click-the-button approach on a freshly compiled page.
 */
async function signInAsPersona(
  page: import("puppeteer").Page,
  personaId: string,
): Promise<void> {
  // Land on a same-origin page first so fetch() is sent to BASE_URL.
  await page.goto(`${BASE_URL}/auth/sign-in`, {
    waitUntil: "domcontentloaded",
  })

  const result = await page.evaluate(async (id: string) => {
    const res = await fetch("/api/auth/demo-sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ personaId: id }),
      credentials: "same-origin",
    })
    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      // ignore parse failure; status is the source of truth
    }
    return { ok: res.ok, status: res.status, body }
  }, personaId)

  if (!result.ok) {
    throw new Error(
      `demo-sign-in failed for "${personaId}": ${result.status} ${JSON.stringify(result.body)}`,
    )
  }
}

async function captureOne(
  browser: Browser,
  target: CaptureTarget,
): Promise<string> {
  const page = await browser.newPage()
  try {
    await page.setViewport(VIEWPORT)

    await signInAsPersona(page, target.personaId)

    await page.goto(`${BASE_URL}${target.route}`, {
      waitUntil: "domcontentloaded",
    })
    await new Promise((resolve) => setTimeout(resolve, HYDRATION_PAUSE_MS))

    await mkdir(target.outDir, { recursive: true })
    const outPath = path.join(target.outDir, "as-built.png")
    await page.screenshot({ path: outPath, fullPage: true, type: "png" })
    return outPath
  } finally {
    await page.close()
  }
}

async function main(): Promise<void> {
  console.log(`Base URL: ${BASE_URL}`)
  await preflight()

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  })

  try {
    for (const target of CAPTURES) {
      console.log(`\n[${target.personaLabel}] -> ${target.route}`)
      const outPath = await captureOne(browser, target)
      console.log(`  saved -> ${outPath}`)
    }
  } finally {
    await browser.close()
  }

  console.log(`\n${CAPTURES.length} capture(s) written.`)
}

main().catch((err) => {
  console.error("Capture failed:", err instanceof Error ? err.message : err)
  process.exit(1)
})
