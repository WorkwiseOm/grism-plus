/**
 * Sync the six DEMO_PERSONA_*_PASSWORD values from .env.local up to
 * the Vercel production environment. Use this after re-running
 * scripts/seed_phase1_demo.ts (which rotates passwords on every run)
 * so the deployed demo persona switcher keeps working.
 *
 * Usage:
 *   npx tsx scripts/sync-demo-passwords-to-vercel.ts
 *
 * Optional:
 *   --redeploy   trigger `vercel deploy --prod --yes` after the env
 *                vars are pushed (env-only changes don't rebuild).
 *
 * Trust boundary:
 *   - Reads from .env.local on the operator's machine.
 *   - Pushes encrypted values to Vercel using the locally-authed CLI.
 *   - Never prints the password values to stdout.
 *
 * Environment requirements:
 *   - vercel CLI installed and `vercel login` already complete.
 *   - .vercel/project.json present (i.e. `vercel link` already run).
 */
import { spawn } from "node:child_process"
import { readFile } from "node:fs/promises"

const PERSONA_KEYS = [
  "DEMO_PERSONA_YUSUF_PASSWORD",
  "DEMO_PERSONA_AISHA_PASSWORD",
  "DEMO_PERSONA_KHALID_PASSWORD",
  "DEMO_PERSONA_FATIMA_PASSWORD",
  "DEMO_PERSONA_OMAR_PASSWORD",
  "DEMO_PERSONA_SAIF_PASSWORD",
] as const

type EnvMap = Record<string, string>

async function readEnvLocal(): Promise<EnvMap> {
  let raw: string
  try {
    raw = await readFile(".env.local", "utf8")
  } catch {
    throw new Error(".env.local not found at project root")
  }
  const out: EnvMap = {}
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq < 1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (value) out[key] = value
  }
  return out
}

async function runVercel(
  args: ReadonlyArray<string>,
  input?: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn("vercel", args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, MSYS_NO_PATHCONV: "1" },
      shell: true,
    })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString()
    })
    child.on("close", (code) => {
      resolve({ code: code ?? 0, stdout, stderr })
    })
    if (input !== undefined) {
      child.stdin.write(input)
      child.stdin.end()
    } else {
      child.stdin.end()
    }
  })
}

async function rmEnv(key: string): Promise<void> {
  const result = await runVercel([
    "env",
    "rm",
    key,
    "production",
    "-y",
  ])
  // Vercel returns non-zero when the var doesn't exist, which is fine
  // for our use case (rm-then-add is idempotent). Only surface errors
  // that aren't "not found".
  const combined = `${result.stdout}${result.stderr}`.toLowerCase()
  if (
    result.code !== 0 &&
    !combined.includes("could not be found") &&
    !combined.includes("does not exist") &&
    !combined.includes("not found")
  ) {
    throw new Error(`vercel env rm ${key} failed: ${result.stderr.trim()}`)
  }
}

async function addEnv(key: string, value: string): Promise<void> {
  const result = await runVercel(
    ["env", "add", key, "production", "-y", "--sensitive"],
    value,
  )
  if (result.code !== 0) {
    throw new Error(`vercel env add ${key} failed: ${result.stderr.trim()}`)
  }
}

async function main(): Promise<void> {
  const env = await readEnvLocal()
  const missing = PERSONA_KEYS.filter((k) => !env[k])
  if (missing.length > 0) {
    throw new Error(
      `Missing in .env.local: ${missing.join(", ")}.\n` +
        `Re-run scripts/seed_phase1_demo.ts and copy the password block ` +
        `into .env.local before re-running this sync.`,
    )
  }

  console.log(`Syncing ${PERSONA_KEYS.length} demo persona passwords -> Vercel production`)
  for (const key of PERSONA_KEYS) {
    process.stdout.write(`  ${key} ... `)
    await rmEnv(key)
    await addEnv(key, env[key])
    console.log("ok")
  }

  const args = process.argv.slice(2)
  if (args.includes("--redeploy")) {
    console.log("\nRedeploying production with new env values...")
    const deploy = await runVercel(["deploy", "--prod", "--yes"])
    if (deploy.code !== 0) {
      throw new Error(`vercel deploy failed: ${deploy.stderr.trim()}`)
    }
    const urlMatch = deploy.stdout.match(/https:\/\/[a-z0-9-]+\.vercel\.app/g)
    if (urlMatch?.length) {
      console.log(`Deployment ready: ${urlMatch[urlMatch.length - 1]}`)
    } else {
      console.log("Deployment ready.")
    }
  } else {
    console.log(
      "\nDone. Pass --redeploy to trigger a production rebuild now; " +
        "otherwise the new env values land at the next deploy.",
    )
  }
}

main().catch((err) => {
  console.error("\nSync failed:", err instanceof Error ? err.message : err)
  process.exit(1)
})
