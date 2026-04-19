import { buildApp } from "./app.js";
import { ensureBucket } from "./lib/storage.js";
import { startTranscriptionWorker } from "./lib/transcription.js";

const port = Number.parseInt(process.env.PORT ?? "4000", 10);
const host = process.env.HOST ?? "0.0.0.0";

await ensureBucket();

const app = buildApp();
const stopTranscriptionWorker =
  process.env.WHISPER_API_URL?.trim()
    ? startTranscriptionWorker(app.log)
    : null;
if (!stopTranscriptionWorker) {
  app.log.info("Transcription worker disabled: WHISPER_API_URL is not configured");
}
app.addHook("onClose", async () => {
  stopTranscriptionWorker?.();
});

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
