import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    // Tests share cloud Supabase state (user_profiles.last_activity_at,
    // security_events). File parallelism would race between, e.g.,
    // idle-timeout tests mutating last_activity_at while sign-in-flow
    // tests read /admin. Serial file execution is the correct model
    // until we introduce per-file test tenants/users.
    fileParallelism: false,
  },
})
