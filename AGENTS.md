# Git & Credential Boundaries

- **No Staged Orchestration Scripts**: Never stage or commit temporary scripts (e.g., helper deployment or utility scripts like `publish_github.ts` or `deploy_worker.ts`) to Git. Use `npx tsx -e "<script>"` or ensure these files are added to `.gitignore` or deleted prior to staging and committing.
- **Strict Environment Separation**: All security keys, tokens (e.g., Cloudflare, GitHub, database UUIDs) must reside strictly in `.env` and be retrieved via `process.env`. Never hardcode raw secrets, fallback secrets, or composite secret arrays in any application code, scripts, or debug tools.
- **Infrastructure Config Exclusion**: Always ensure local cloud infrastructure files containing database bindings, resource IDs, or configuration schemas (such as `wrangler.toml`) are added to `.gitignore` before any stage or commit operation.
