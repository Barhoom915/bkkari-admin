# NOVATEK ADMIN V72.0.3 — Release Notes

## Enhancements
- Main dashboard refreshes every 60 seconds and shows the last successful refresh time.
- Added a daily operations center with shortcuts to orders, wallet top-ups, alerts, activity log, administrators, and settings.
- Added quick links to customers, wallet top-ups, and website requests.
- Added `Ctrl/⌘ + K` keyboard shortcut to focus global search. `Esc` clears search results and closes the mobile menu.
- Added visible keyboard focus states, reduced-motion support, and responsive operations cards.
- Updated README version badge and release history.

## Scope
- Admin dashboard only. The NOVATEK storefront project was not changed.
- No new database tables or SQL migrations are required for these UI changes.

## Validation
- Source-level edits completed. Production build and live Supabase behavior must be checked in the deployment environment before treating this release as production-verified.
