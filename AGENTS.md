# Project instructions

- Preserve the Vue baseline at commit `06e241c` in the separate legacy repository.
- Use Node.js 24 and npm workspaces. Run `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build`, and the PostgreSQL-backed tests before release.
- React code lives in `frontend/`. Express, migrations and the curated course dataset live in `backend/`. Put submission notes and deployment verification in `docs/`.
- Keep application and database configuration in environment variables. Never commit credentials, database dumps, or individual submissions with personal information.
- Explain legacy-to-new behavior and retain public provenance in Simplified Chinese. Use English for API contracts and names in code.
