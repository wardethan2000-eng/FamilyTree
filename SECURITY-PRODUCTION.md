# Security Items for Production Launch

This file tracks security items that cannot be fully resolved in code at the current stage of development and require infrastructure, operational, or product decisions before production launch.

---

## Critical

### ~~C6: No Account Deletion / Data Erasure Endpoint~~ ✅ Implemented
Users cannot delete their accounts or exercise their right to erasure (GDPR Article 17, CCPA). There is no `DELETE /api/me/account` endpoint.

**Implemented in code:**
1. `DELETE /api/me/account` endpoint with `{ confirm: true }` body requirement
2. All 8 RESTRICT foreign keys changed to SET NULL (migration `0021_quick_calypso.sql`)
3. `deleted_users` table stores user name/email snapshot for attribution
4. Steward/founder transfer: promotes longest-standing member to steward; reassigns founder
5. Sessions, accounts, verifications deleted before user row
6. Cascade handles: memberships, notification prefs

**Still needed before production:**
- Notify tree stewards of the departure (email notification)
- Add `GET /api/me/export` for GDPR data portability
- Consider grace period / undo window (30-day soft delete)

### HTTPS Enforcement
The application does not enforce HTTPS at the application level. Rely on the Cloudflare Tunnel for TLS termination, but add an `onRequest` hook to redirect HTTP requests (`X-Forwarded-Proto: http`) to HTTPS in production:

```ts
app.addHook("onRequest", async (request, reply) => {
  if (process.env.NODE_ENV === "production" && request.headers["x-forwarded-proto"] === "http") {
    const url = new URL(request.url, `https://${request.headers.host}`);
    return reply.redirect(301, url.toString());
  }
});
```

---

## High

### Rate Limiting
No rate limiting exists on any endpoint. Install `@fastify/rate-limit` and configure:

```bash
pnpm add @fastify/rate-limit --filter @tessera/api
```

```ts
import rateLimit from "@fastify/rate-limit";
app.register(rateLimit, { max: 100, timeWindow: "1 minute" });
```

Apply stricter limits on auth endpoints (5-10/min), invitation creation (10/min), and elder capture token minting (10/min). For multi-instance production, configure a Redis store.

### Explicit Cookie Security Attributes
Better Auth manages cookies internally. Verify and explicitly configure `Secure`, `HttpOnly`, and `SameSite=Lax` attributes:

```ts
export const auth = betterAuth({
  // ...
  cookies: {
    sessionToken: {
      attributes: {
        secure: true,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      },
    },
  },
});
```

### CSRF Protection
All custom API routes lack CSRF tokens. The `SameSite=Lax` cookie attribute provides baseline protection, but add a custom header requirement (`X-Requested-With`) or `@fastify/csrf-protection` for defense in depth.

### `.env.example` Files Contain Real Credentials and Internal IPs
All `.env.example` files still contain actual-looking passwords and internal network IPs. Replace with placeholders:

```
DATABASE_URL=postgres://tessera:CHANGE_ME@localhost:5432/tessera
MINIO_ACCESS_KEY=CHANGE_ME
MINIO_SECRET_KEY=CHANGE_ME
BETTER_AUTH_SECRET=CHANGE_ME_use_openssl_rand_base64_32
```

### `NEXT_PUBLIC_MEDIA_URL` Exposes MinIO Internally
The `apps/web/.env.local` variable `NEXT_PUBLIC_MEDIA_URL` embeds the MinIO IP and bucket name in client-side JS. Remove this variable and route all media through the authenticated `/api/media` proxy.

### Sanitize `infra/proxmox-access.md`
This file intentionally stays in git for dev convenience, but it contains internal IPs, Tailscale IPs, SSH key paths, and a Cloudflare Tunnel ID. Before going public:
- Rotate the Cloudflare Tunnel ID
- Ensure the repo is private or move infra docs to a private knowledge base

---

## Medium

### Password Strength Requirements
Better Auth defaults to 8-character minimum with no complexity requirements. Add `minPasswordLength: 10` and consider a custom password validation hook.

### Unauthenticated Prompt Reply Creates Ghost Accounts
The prompt reply link flow creates accounts with `email_<uuid>` when the replier doesn't have an account. These ghost accounts persist indefinitely. Add a scheduled cleanup for unverified `email_*` accounts older than 30 days.

### No Cleanup of Expired Invitations/Tokens
Invitations expire after 7 days and prompt reply links after 14 days, but no background job marks them expired or deletes them. Add scheduled cleanup jobs.

### SMTP Uses Opportunistic TLS Only
The mailer uses `secure: port === 465`, meaning port 587 uses opportunistic TLS. For production, enforce TLS with `requireTLS: true` or use port 465.

### No Database-Level Encryption at Rest
OAuth tokens (`accessToken`, `refreshToken`, `idToken`) and verification tokens are stored in plaintext columns. Enable PostgreSQL TDE or filesystem-level encryption. Consider `pgcrypto` for OAuth token columns.

**Feasibility assessment:**
- PostgreSQL does not have native TDE. Options are:
  1. **Filesystem-level encryption (LUKS)** — simplest, transparent to the app. Encrypt the volume holding `/var/lib/postgresql`. Zero code changes. Already standard on most cloud VMs. **Recommended.**
  2. **`pgcrypto` column encryption** — encrypt specific columns (`accounts.accessToken`, `accounts.refreshToken`, `accounts.idToken`, `verifications.value`) application-side with a key managed in env vars or a KMS. Requires code changes in Better Auth adapter or raw SQL overrides.
  3. **Cloud provider encryption** — if moving to managed Postgres (RDS, Cloud SQL), encryption at rest is typically a checkbox.
- For the current Proxmox self-hosted setup, LUKS on the PostgreSQL data volume is the most practical path.

### In-Memory Rate Limiting Is Ineffective
The elder capture submission rate limit uses an in-memory `Map` that resets on restart. Replace with `@fastify/rate-limit` backed by Redis for production.

### Export Doesn't Include User Profile Data
The tree export is incomplete for GDPR right of access. Add a `GET /api/me/export` endpoint that bundles all user data across all trees including profile, membership history, notification preferences, and activity.

### ~~Notification Preferences Default Opt-In~~ ✅ Fixed
`systemEmail` defaults to `true`. For GDPR compliance, non-essential email defaults should be `false`.

**Fixed:** Default changed to `false` (migration `0022_wild_donald_blake.sql`), existing rows updated.

### Prompt Campaign Scheduler Logs Recipient Emails
The campaign scheduler logs `email` in some error paths. Remove PII from log payloads.

---

## Low

### Test Files Use Hardcoded Database Credentials
Multiple test files contain `postgresql://` connection strings with real usernames. Use `process.env.DATABASE_URL ??=` pattern.

### Members List Tree Responses Include `founderUserId` and Subscription Details
Multiple tree endpoints spread the full tree row into responses. Strip `founderUserId`, `tier`, `subscriptionStatus`, and `subscriptionExpiresAt`.

### Memory List Has No Pagination
The memories list returns up to 200 with no cursor or `hasMore` indicator.

### File Size Validated by Declared Value Only
Media upload size is validated by client-declared `sizeBytes`, not actual upload. Add S3 head-object verification after upload.

---

## Pre-Launch Checklist

- [ ] Configure `BETTER_AUTH_SECRET`, `TRUSTED_ORIGINS`, `API_BASE_URL` in production environment (now required, no fallback)
- [ ] Configure `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` in production
- [ ] Add rate limiting (`@fastify/rate-limit`)
- [ ] Add CSRF protection
- [ ] Set explicit cookie security attributes
- [ ] Rotate Cloudflare Tunnel ID (exposed in `proxmox-access.md`)
- [ ] Enforce HTTPS redirect
- [x] Build account deletion endpoint
- [ ] Add `GET /api/me/export` for GDPR
- [ ] Configure production SMTP with TLS
- [ ] Replace `.env.example` credentials with placeholders
- [ ] Remove `NEXT_PUBLIC_MEDIA_URL`
- [x] Change `systemEmail` default to `false`