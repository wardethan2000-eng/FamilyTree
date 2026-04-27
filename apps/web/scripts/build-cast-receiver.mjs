import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const ts = require("typescript");

const cssPath = resolve(webRoot, "src", "cast", "receiver.css");
const tsPath = resolve(webRoot, "src", "cast", "receiver.ts");
const templatePath = resolve(webRoot, "src", "cast", "receiver.html.template");
const outputPath = resolve(webRoot, "public", "cast", "receiver.html");

const css = readFileSync(cssPath, "utf-8");
const tsSource = readFileSync(tsPath, "utf-8");
const template = readFileSync(templatePath, "utf-8");

const transpiled = ts.transpileModule(tsSource, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.None,
    removeComments: true,
    isolatedModules: false,
  },
  reportDiagnostics: true,
});

if (transpiled.diagnostics && transpiled.diagnostics.length > 0) {
  for (const d of transpiled.diagnostics) {
    const message = ts.flattenDiagnosticMessageText(d.messageText, "\n");
    console.error(`[build-cast-receiver] ${message}`);
  }
}

const html = template
  .replace("/* __STYLES__ */", () => css)
  .replace("/* __SCRIPT__ */", () => transpiled.outputText);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, html, "utf-8");
console.log(`Built receiver to ${outputPath}`);
