import { readFileSync, existsSync } from "node:fs";
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

const DIST_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../web/dist-viewer",
);

let cachedViewerJs: string | null = null;
let cachedViewerCss: string | null = null;

function loadViewerJs(): string {
  if (cachedViewerJs) return cachedViewerJs;
  const path = resolve(DIST_DIR, "viewer.js");
  if (!existsSync(path)) {
    throw new Error(
      `Archive viewer bundle not found at ${path}. Run "pnpm build:viewer" in apps/web first.`,
    );
  }
  cachedViewerJs = readFileSync(path, "utf-8");
  return cachedViewerJs;
}

function loadViewerCss(): string | null {
  if (cachedViewerCss !== null) return cachedViewerCss;
  const path = resolve(DIST_DIR, "viewer.css");
  if (!existsSync(path)) {
    cachedViewerCss = "";
    return null;
  }
  cachedViewerCss = readFileSync(path, "utf-8");
  return cachedViewerCss;
}

export function renderIndexHtml(manifest: ArchiveExportManifest): string {
  const js = loadViewerJs();
  const css = loadViewerCss();
  const encoded = JSON.stringify(manifest).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
  const dateStr = new Date(manifest.exportedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const styleTag = css
    ? `<style>\n${css}\n</style>`
    : `<link rel="stylesheet" href="assets/viewer.css" />`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(manifest.tree.name)} — Family Archive</title>
  ${styleTag}
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