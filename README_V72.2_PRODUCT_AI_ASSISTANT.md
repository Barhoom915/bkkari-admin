# NOVATEK Admin V72.2 — مساعد بيانات المنتجات

- Added authenticated server route `/api/admin/product-assistant`.
- Supports Groq (`GROQ_API_KEY`), OpenRouter (`OPENROUTER_API_KEY`), or Gemini (`GEMINI_API_KEY`, `GOOGLE_AI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`) using server-side keys only.
- Added product review/correction, automatic description generation, and feature generation buttons to the laptop create/edit form.
- Assistant prompt is constrained to supplied product facts and must identify missing details rather than inventing specs. Changes are applied to the unsaved form and require the admin to save normally.
- If no supported AI key is configured, the endpoint returns a clear error; it does not fabricate output.
- Store project files are not included or modified.

Deployment requirements: ensure at least one supported provider key is configured in the **admin project's** Vercel environment, then redeploy. Build has not been run in this environment because project dependencies are not installed.

## V72.2.1 — Multi-provider product AI
- Product assistant now tries each configured provider in sequence: Groq, OpenRouter, Gemini / Google AI Studio, then Ashna if an OpenAI-compatible endpoint is explicitly configured.
- Supported environment variables: `GROQ_API_KEY`, `GROQ_PRODUCT_MODEL`, `OPENROUTER_API_KEY`, `OPENROUTER_PRODUCT_MODEL`, `GEMINI_API_KEY` (or `GOOGLE_AI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY`), `GEMINI_PRODUCT_MODEL`.
- Optional Ashna adapter requires `ASHNA_API_KEY`, `ASHNA_BASE_URL` (base URL without trailing slash, expected to expose `/chat/completions`), and `ASHNA_PRODUCT_MODEL` or `ASHNA_MODEL`. Ashna is not guessed or called unless all three are present.
- The API returns the provider that actually succeeded and whether fallback was used. If every configured provider fails, the response reports provider names/statuses without exposing API keys.
- The assistant still only drafts suggestions; it does not save product changes or change price/stock.
