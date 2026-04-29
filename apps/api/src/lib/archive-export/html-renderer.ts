import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ArchiveExportManifest } from "./types.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const VIEWER_JS_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../web/dist-viewer/viewer.js",
);

let cachedViewerJs: string | null = null;

function loadViewerJs(): string {
  if (cachedViewerJs) return cachedViewerJs;
  cachedViewerJs = readFileSync(VIEWER_JS_PATH, "utf-8");
  return cachedViewerJs;
}

export function renderIndexHtml(manifest: ArchiveExportManifest): string {
  const js = loadViewerJs();
  const encoded = JSON.stringify(manifest).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
  const dateStr = new Date(manifest.exportedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(manifest.tree.name)} — Family Archive</title>
</head>
<body>
  <div id="app"></div>
  <noscript>
    <div style="max-width:480px;margin:80px auto;padding:24px;font-family:Georgia,serif;color:#1C1915;">
      <h2 style="font-weight:400;">${escapeHtml(manifest.tree.name)}</h2>
      <p>This offline archive requires JavaScript to view. Please open this file in a browser with JavaScript enabled.</p>
    </div>
  </noscript>
  <footer class="footer">
    Tessera · private family archive · ${escapeHtml(manifest.tree.name)} · exported ${dateStr}
  </footer>
  <script>
    window.ARCHIVE_DATA = ${encoded};
  </script>
  <script>
    ${js}
  </script>
</body>
</html>`;
}