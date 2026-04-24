-- Seed SOC 2 subprocessor register with the 5 documented vendors.
-- Idempotent via ON CONFLICT (name) DO NOTHING: safe to re-apply.
--
-- IMPORTANT: updates to existing subprocessor rows (e.g., a changed DPA URL,
-- a new hosting region, a renewed SOC 2 status) require a NEW migration
-- file (e.g., 00007_update_anthropic_dpa_url.sql), not an edit to this file
-- and certainly not a re-run. This preserves the audit trail required for
-- subprocessor change notifications to customers.
--
-- Source of truth for prose: docs/subprocessors.md.

insert into public.subprocessors
  (name, purpose, data_categories, location, soc2_status, gdpr_status, dpa_url, is_active)
values
  (
    'Supabase',
    'Hosted Postgres database, authentication, row-level security, storage, Edge Functions, vector search',
    array['employee records', 'assessments', 'IDPs', 'OJT evidence', 'coaching briefs', 'audit logs'],
    'Sydney, Australia (ap-southeast-2). MVP development project; region selected by operator default during provisioning, not by data residency policy. Production deployment region to be determined by data residency requirements of the first customer contract, most likely Frankfurt for GCC proximity.',
    'Type II certified',
    'compliant, DPA executed',
    'https://supabase.com/legal/dpa',
    true
  ),
  (
    'Vercel',
    'Next.js application hosting, serverless function execution, edge caching, custom domain TLS',
    array['request payloads in transit', 'server-side rendering payloads (may include PII)', 'environment variables (secrets)'],
    'Not yet provisioned. Intended hosting region: Frankfurt (production). Will be activated in the migration that provisions the Vercel project (Phase 0 Step 9). Until then, no Grism Plus customer data flows through Vercel.',
    'Type II certified',
    'compliant, DPA executed',
    'https://vercel.com/legal/dpa',
    false
  ),
  (
    'Anthropic',
    'Claude API for four AI nodes: IDP generation, modality recommendation, OJT recommendation, coaching brief generation',
    array['pseudonymised employee role', 'competency gap summaries', 'IDP structure'],
    'United States',
    'Type II certified',
    'compliant, DPA available',
    'https://www.anthropic.com/legal/commercial-terms',
    true
  ),
  (
    'Resend',
    'Transactional email delivery for nudges, approval notifications, password resets, weekly digests',
    array['recipient email address', 'recipient display name', 'email subject and body (may reference employee development status in pseudonymised form)'],
    'United States',
    'Type II certified',
    'compliant, DPA available',
    'https://resend.com/legal/dpa',
    true
  ),
  (
    'GitHub',
    'Source code hosting, CI/CD via Actions, dependency scanning via Dependabot, static analysis via CodeQL',
    array['application source code only'],
    'United States (primary)',
    'Type II certified',
    'compliant',
    'https://docs.github.com/en/site-policy/privacy-policies/github-data-protection-agreement',
    true
  )
on conflict (name) do nothing;
