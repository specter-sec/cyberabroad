# Security and data integrity

CyberAbroad is a static public-data explorer. It has no authentication, document uploads, payment processing, or student application backend. It must never request or store passports, credentials, payment details, private admission letters, or personal application records.

## Boundaries

- Treat dataset strings as untrusted. Escape rendered HTML and accept only HTTPS destination links. Do not execute source content or add arbitrary markup to records.
- CSV exports must neutralize spreadsheet formulas even after leading whitespace, and quote commas, quotes, and newlines correctly. Opening untrusted CSV files can still have risks depending on the spreadsheet application.
- Shortlist program IDs and theme preferences live in browser localStorage, not a private vault. Scripts sharing an origin, browser extensions, or someone with device access may inspect them. Project-scoped key names prevent accidental collisions, not origin-level access by other GitHub Pages projects.
- Hosting and official sites may log normal requests; “no app analytics” does not mean the internet is anonymous. The site is not affiliated with or endorsed by the listed universities.
- Schema/provenance tests detect structural regressions, not false statements on official pages, compromised websites, stale information, or eligibility changes. Human review and the reader's own verification are required.
- PR checks have read-only repository permissions. Only non-PR deployments receive scoped Pages/OIDC permissions, and action references are pinned to commit hashes. No application secrets are required.

## Reporting

For inaccurate fees, deadlines, or eligibility, open a normal correction issue with the record ID and an official source. For exploitable script injection, unsafe links, or accidental personal-data exposure, use the repository's private vulnerability reporting option if enabled. Otherwise open a minimal issue requesting a private reporting channel; do not post exploit payloads, secrets, or personal information publicly.

There is no guaranteed response time. Original code and data are provided without warranty; see LICENSE.
