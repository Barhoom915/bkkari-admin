# NOVATEK Admin V72.0.7 — Environment status clarity

Admin-only change. Store files were not modified.

- Missing provider keys now explicitly say they are missing from the admin deployment environment and do not prove the store integration is down.
- Configured-but-unverified keys are described as configured only, not healthy.
- Probe latency now measures the completed provider request rather than the time before it starts.
- No API secret values are returned to the browser.

Verification: source-level checks only; a full Next.js build was not run in this environment.
