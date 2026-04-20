# AGENTS

- Keep [PRODUCT-ROADMAP.md](./PRODUCT-ROADMAP.md) current: add new ideas to the right phase or backlog, mark completed items as `[x]`, and revise or cross out outdated items when product direction changes.
- Before making product or architecture changes, read the relevant roadmap / spec docs and keep implementation aligned with them instead of drifting into ad hoc features.
- Prefer small, coherent changes that match the existing architecture; refactor when necessary for clarity or correctness, but avoid speculative rewrites.
- Preserve security and trust by default: validate inputs, protect auth and permission boundaries, avoid leaking private family data, and never weaken export / visibility / subject-sovereignty guarantees casually.
- When changing behavior, add or update the most relevant tests if the repo has coverage for that area; if tests are missing or cannot be run, note the gap clearly.
- Do not silently skip migrations, deployment implications, or backwards-compatibility concerns when changing schema, storage, auth, or API contracts.
- Do not commit secrets, tokens, passwords, or private keys. Server access and deployment notes live in [infra/proxmox-access.md](./infra/proxmox-access.md) and infra docs, not in code or env files checked into git.
- Treat server deployments carefully: do not assume the currently running app is in the same checkout as the local repo, do not overwrite a dirty live checkout, prefer a separate deployment checkout or deliberate cutover, and verify health after changes.
- When updating the server or deployment setup, also update the relevant runbook docs in `infra/` so the next agent does not have to rediscover the process.
