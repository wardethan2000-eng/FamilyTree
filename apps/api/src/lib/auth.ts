import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { magicLink } from "better-auth/plugins";
import { db } from "./db.js";
import * as schema from "@tessera/database";
import { mailer, MAIL_FROM } from "./mailer.js";
import { emailTemplates, escapeHtml } from "./email-templates.js";

const WEB_URL = process.env.WEB_URL ?? "http://localhost:3000";

function buildWebUrl(webPath: string, token: string | undefined, url?: string): string {
  const params = new URLSearchParams();
  if (token) params.set("token", token);
  // Preserve any callbackURL from the original better-auth URL (query or path).
  if (url) {
    try {
      const parsed = new URL(url);
      const cb = parsed.searchParams.get("callbackURL");
      if (cb) params.set("callbackURL", cb);
    } catch {
      // ignore
    }
  }
  const qs = params.toString();
  return `${WEB_URL}${webPath}${qs ? `?${qs}` : ""}`;
}

function rewriteAuthUrl(url: string, webPath: string): string {
  // Legacy helper for URLs where token is a query param (magic link, verify).
  try {
    const parsed = new URL(url);
    const token = parsed.searchParams.get("token");
    const callback = parsed.searchParams.get("callbackURL");
    const params = new URLSearchParams();
    if (token) params.set("token", token);
    if (callback) params.set("callbackURL", callback);
    return `${WEB_URL}${webPath}?${params.toString()}`;
  } catch {
    return url;
  }
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    sendResetPassword: async ({ user, url, token }) => {
      const resetUrl = buildWebUrl("/auth/reset-password", token, url);
      await mailer.sendMail({
        from: MAIL_FROM,
        to: user.email,
        subject: "Reset your Tessera password",
        html: emailTemplates.shell(
          "Reset your password",
          emailTemplates.paragraph(
            `We received a request to reset the password for your Tessera account. Click below to choose a new one.`,
          ) + emailTemplates.button(resetUrl, "Reset password"),
          "This link expires in 1 hour. If you did not request this, you can safely ignore this email.",
        ),
        text: `Reset your Tessera password: ${resetUrl}\n\nThis link expires in 1 hour. If you did not request this, you can safely ignore it.`,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url, token }) => {
      const verifyUrl = buildWebUrl("/auth/verify-email", token, url);
      await mailer.sendMail({
        from: MAIL_FROM,
        to: user.email,
        subject: "Confirm your Tessera email",
        html: emailTemplates.shell(
          "Confirm your email",
          emailTemplates.paragraph(
            `Welcome to Tessera${user.name ? `, ${escapeHtml(user.name)}` : ""}. Please confirm this email address so we can reach you about invitations and family memories.`,
          ) + emailTemplates.button(verifyUrl, "Confirm email"),
          "If you did not create a Tessera account, you can safely ignore this email.",
        ),
        text: `Confirm your Tessera email: ${verifyUrl}\n\nIf you did not create a Tessera account, ignore this email.`,
      });
    },
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        const signinUrl = rewriteAuthUrl(url, "/auth/magic-link");
        await mailer.sendMail({
          from: MAIL_FROM,
          to: email,
          subject: "Sign in to Tessera",
          html: emailTemplates.shell(
            "Sign in to Tessera",
            emailTemplates.paragraph("Click below to sign in to your account.") +
              emailTemplates.button(signinUrl, "Sign in"),
            "This link expires shortly. If you did not request this, you can ignore it.",
          ),
          text: `Sign in to Tessera: ${signinUrl}`,
        });
      },
    }),
  ],
  trustedOrigins: (() => { const v = process.env.TRUSTED_ORIGINS; if (!v) throw new Error("TRUSTED_ORIGINS environment variable is required"); return v.split(","); })(),
  secret: (() => { const v = process.env.BETTER_AUTH_SECRET; if (!v) throw new Error("BETTER_AUTH_SECRET environment variable is required"); return v; })(),
  baseURL: (() => { const v = process.env.API_BASE_URL; if (!v) throw new Error("API_BASE_URL environment variable is required"); return v; })(),
});

export type Auth = typeof auth;
