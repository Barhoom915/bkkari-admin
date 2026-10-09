# NOVATEK Admin V72.0.5.1 — API account monitoring

- Replaces the documentation-only endpoint list with a clickable provider inventory.
- The server-side `/api/admin/integrations` route checks configured integrations without returning secret values.
- SerpApi account usage is loaded from the official Account API when `SERPAPI_API_KEY` or `SERPAPI_KEY` is configured in the **admin project's server environment**. It displays searches used, quota remaining, monthly quota/plan price, extra credits, hourly use/limit, account status, and renewal date only if the provider returns it.
- SatoFill uses a read-only balance request for a live connection check.
- Supabase uses a minimal admin-auth read to verify connectivity.
- Optional provider keys are shown as configured/not configured only. Usage/billing details are not fabricated where a provider-specific billing endpoint and permissions are not available.
- Secrets are never returned to the browser. Do not paste API keys into the frontend or chat.

## Environment
Add `SERPAPI_API_KEY` in the hosting environment for the **admin deployment**, then redeploy. If the key exists only in the store project's hosting settings, the admin cannot read it automatically.
