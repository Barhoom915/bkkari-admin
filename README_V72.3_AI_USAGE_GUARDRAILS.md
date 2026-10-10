# NOVATEK Admin — AI usage guardrails

The `feat/ai-usage-guardrails` branch adds a per-account quota table to the existing AI analytics dashboard. It displays current daily, monthly, and per-minute counters without exposing guest IP hashes.

## Database requirement
Apply `supabase/v71_ai_analytics_ledger.sql` from this repository and `supabase/v98_29_ai_usage_guardrails.sql` from `Barhoom915/Bkkari-Tech` to the **same Supabase project**. The store enforces quotas and writes events; the admin app reads the event ledger and quota counters.

Default limits are 6 requests per rolling minute, 30 per UTC day, and 300 per UTC calendar month. Provider token usage and cost remain explicitly unavailable until the upstream provider response includes measured usage values. No secrets or Vercel settings are modified.
