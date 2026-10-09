# NOVATEK Admin — V71 starting pass

This is the first implementation pass on the existing `bkkari-admin-v70` project, preserving its existing routes and Supabase patterns.

## Changes in this pass
- Updated admin title/visible brand to NOVATEK and added the NOVATEK logo asset.
- Added an AI Analytics navigation entry.
- Added `/ai-analytics` and protected `/api/admin/ai-analytics` for real records from `public.ai_usage_events`.
- The analytics page clearly reports missing schema instead of showing mock numbers.
- Added `supabase/v71_ai_analytics_ledger.sql` to create the analytics ledger without resetting existing comparison quotas.

## Setup
1. Run `supabase/v71_ai_analytics_ledger.sql` in the correct Supabase project SQL Editor only if `public.ai_usage_events` does not already exist.
2. Ensure the admin deployment has `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and a server-only `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`.
3. Deploy this admin project to its existing hosting target.

## Important limitations
- This pass provides the admin readout; the store's AI provider functions still need instrumentation to record actual model, token counts, and pricing for every provider call. Existing records that lack those fields will be shown as missing, not fabricated.
- Provider account balance/quota is not inferred from request costs; it is shown only if a provider-specific official balance endpoint is integrated later.
- Build validation could not be completed in this environment because `npm ci` did not finish before timeout. Run `npm ci` and `npm run build` locally before deployment.
