# NOVATEK Admin V72.0.6 — In-site API Control Center

## Scope
Admin project only. The store project and store files were not modified.

## UI
- API cards navigate to `/api-settings/[provider]` inside the same Next.js site and browser tab.
- No modal is used for API detail views.
- The normal AdminShell sidebar/header remain present.
- Main groups: AI (Google AI Studio/Gemini, Ashna, Groq, OpenRouter), search/comparison (SerpApi, Tavily, SyriMarket), digital providers (SatoFill, SyriMarket, upcoming SW-Games).
- SW-Games remains `planned` until configured and verified.

## Live checks
- SerpApi account details use its account endpoint.
- SatoFill uses the existing server-side balance helper.
- Google AI/Gemini performs a non-billable models-list request when configured.
- Groq performs a models-list request when configured.
- OpenRouter checks `/api/v1/key` when configured and displays the available usage/limit values.
- Tavily does not run a search as a health check, to avoid spending search credits. Ashna and SyriMarket show configuration state until their documented official account/status endpoints are available.
- No secrets are returned to the browser. Provider billing fields are displayed only when actually returned by the provider.

## Environment
Optional keys: `GEMINI_API_KEY`, `GOOGLE_AI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `ASHNA_API_KEY`, `ASHNA_API_TOKEN`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `TAVILY_API_KEY`, `SYRIMARKET_API_KEY`, `SYRIMARKET_API_URL`, `SW_GAMES_API_KEY`, `SW_GAMES_API_TOKEN`.

Set only the providers you actually use in the admin deployment environment. Do not paste secrets into the browser or chat.
