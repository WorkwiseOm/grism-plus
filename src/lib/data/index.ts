/**
 * Server-side data loaders for Phase 1 product screens.
 *
 * Every loader uses the authenticated Supabase server client (cookies()
 * via @/lib/supabase/server) so RLS remains the boundary. None of these
 * loaders use the service-role admin client; tenant scoping is enforced
 * by Postgres, not application code.
 *
 * All loaders return a discriminated LoaderResult<T> for predictable
 * empty/authz handling. See ./types for the failure-reason taxonomy.
 *
 * These modules are server-only — they will throw at runtime if imported
 * from a client component, because createClient() reads next/headers
 * cookies. Server components, server actions, and route handlers may
 * import them freely.
 */
export type { LoaderResult, LoaderFailureReason } from "./types"
export { ok, fail } from "./types"

export {
  getCurrentEmployeeContext,
  type CurrentEmployeeContext,
} from "./current-employee"

export {
  getIdpSummaryList,
  groupIdpSummariesByStatus,
  getIdpDetail,
  groupActionsByMilestone,
  type IdpSummaryRow,
  type IdpSummaryFilter,
  type IdpDetail,
  type IdpDetailMilestone,
  type IdpDetailAction,
  type IdpDetailEmployee,
} from "./idps"

export {
  getManagerTeamRollup,
  groupIdpsByEmployee,
  buildTeamMemberRollup,
  type TeamMemberRollup,
} from "./manager-team"

export {
  getFrameworkTree,
  buildCompetencyTree,
  type FrameworkTree,
  type CompetencyNode,
} from "./framework"

export {
  getEmployeeOjtAssignments,
  buildOjtAssignmentDetails,
  type OjtAssignmentDetail,
} from "./ojt"
