# NOVATEK Admin V72.2 — مساعد بيانات المنتجات

- Added authenticated server route `/api/admin/product-assistant`.
- Supports Groq (`GROQ_API_KEY`), OpenRouter (`OPENROUTER_API_KEY`), or Gemini (`GEMINI_API_KEY`, `GOOGLE_AI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`) using server-side keys only.
- Added product review/correction, automatic description generation, and feature generation buttons to the laptop create/edit form.
- Assistant prompt is constrained to supplied product facts and must identify missing details rather than inventing specs. Changes are applied to the unsaved form and require the admin to save normally.
- If no supported AI key is configured, the endpoint returns a clear error; it does not fabricate output.
- Store project files are not included or modified.

Deployment requirements: ensure at least one supported provider key is configured in the **admin project's** Vercel environment, then redeploy. Build has not been run in this environment because project dependencies are not installed.
