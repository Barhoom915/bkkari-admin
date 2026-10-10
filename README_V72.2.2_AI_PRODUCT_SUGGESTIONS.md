# NOVATEK Admin V72.2.2 — Animated AI descriptions & inline suggestions

- Product descriptions and features are written into their fields with a subtle typing animation.
- Prompt asks for a polished Arabic store tone with only a few relevant emojis.
- Review suggestions are not auto-applied. Each suggestion appears under its related product field in a translucent orange card with a lightbulb icon, current/proposed value, reason, Apply and Ignore actions.
- Uncertain technical specifications must be flagged for verification instead of guessed.
- Prices and stock are never auto-changed by the assistant.
- Modified files: `app/products/page.tsx`, `app/api/admin/product-assistant/route.ts`, `app/globals.css`, `VERSION`.

Validation: full Next.js build was not completed in this environment because `npm ci` timed out. Run deployment/build validation in Vercel before treating this release as production-verified.
