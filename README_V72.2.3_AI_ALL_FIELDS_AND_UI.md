# NOVATEK ADMIN V72.2.3

- Product AI review prompt now checks all laptop/product fields, not just screen resolution.
- Explicitly prohibits guessing replacement CPU/GPU/model specifications (e.g. turning an ambiguous `i5 10U` into a specific CPU model). Uncertain corrections should be verification notes with no proposed replacement value.
- Product assistant rotates the first configured provider between requests, then falls back to the other configured providers when a request fails. Providers still require valid Vercel admin environment variables. Ashna requires a compatible base URL and model.
- Light-first NOVATEK orange/white/black styling override for dashboard hero/actions and consistent checkbox/radio sizing/alignment.

No full production build has been run in this environment. Verify the Vercel build and test each configured provider after deployment.
