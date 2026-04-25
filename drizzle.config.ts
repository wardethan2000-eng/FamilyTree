import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "../../drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://placeholder:5432/db",
  },
  strict: true,
  verbose: true,
});
