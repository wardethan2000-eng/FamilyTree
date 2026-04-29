# AGENTS

- Keep [PRODUCT-ROADMAP.md](./PRODUCT-ROADMAP.md) current: add new ideas to the right phase or backlog, mark completed items as `[x]`, and revise or cross out outdated items when product direction changes.
- Before making product or architecture changes, read the relevant roadmap / spec docs and keep implementation aligned with them instead of drifting into ad hoc features.
- Prefer small, coherent changes that match the existing architecture; refactor when necessary for clarity or correctness, but avoid speculative rewrites.
- Preserve security and trust by default: validate inputs, protect auth and permission boundaries, avoid leaking private family data, and never weaken export / visibility / subject-sovereignty guarantees casually.
- When changing behavior, add or update the most relevant tests if the repo has coverage for that area; if tests are missing or cannot be run, note the gap clearly.
- Do not start local dev servers from this environment unless the user explicitly asks for one. Prefer typecheck, focused lint, tests, production build checks, or deployment verification instead.
- Do not silently skip migrations, deployment implications, or backwards-compatibility concerns when changing schema, storage, auth, or API contracts.
- Do not commit secrets, tokens, passwords, or private keys. Server access and deployment notes live in [infra/proxmox-access.md](./infra/proxmox-access.md) and infra docs, not in code or env files checked into git.
- Treat server deployments carefully: do not assume the currently running app is in the same checkout as the local repo, do not overwrite a dirty live checkout, prefer a separate deployment checkout or deliberate cutover, and verify health after changes.
- When updating the server or deployment setup, also update the relevant runbook docs in `infra/` so the next agent does not have to rediscover the process.

## Agent Execution Guidance

- Before editing, check `git status --short` and avoid touching unrelated user changes. Commit only files that belong to the current task.
- Prefer focused verification over broad expensive checks: run targeted tests, typecheck, and focused lint for touched files first. Run full lint/build when the change risk justifies it or before deployment.
- When the runtime supports subagents or model selection, use cheaper/read-only subagents for bounded exploration tasks such as finding relevant files, summarizing existing patterns, checking docs, or preparing mechanical git steps.
- Cheaper subagents/models may also handle low-risk commit and push tasks when the intended file set and commit message are clear. The main agent remains responsible for reviewing the diff and ensuring only scoped changes are committed.
- Keep implementation, final integration, secrets handling, live deployment, and risky git operations in the main agent unless the user explicitly delegates them.
- Do not spawn subagents for vague work. Give each subagent a narrow question, expected output, and clear file boundaries. Avoid duplicate exploration.
- Prefer stronger models for high-risk architecture, security, data migration, deployment, or complex cross-module changes.
