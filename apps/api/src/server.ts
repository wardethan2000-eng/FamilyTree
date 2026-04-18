import { buildApp } from "./app.js";
import { ensureBucket } from "./lib/storage.js";

const port = Number.parseInt(process.env.PORT ?? "4000", 10);
const host = process.env.HOST ?? "0.0.0.0";

await ensureBucket();

const app = buildApp();

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
