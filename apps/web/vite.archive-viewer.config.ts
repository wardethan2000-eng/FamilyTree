import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  plugins: [preact()],
  build: {
    outDir: "dist-viewer",
    emptyOutDir: true,
    rollupOptions: {
      input: "src/archive-viewer/index.tsx",
      output: {
        entryFileNames: "viewer.js",
        assetFileNames: "viewer.[ext]",
        format: "iife",
        name: "ArchiveViewer",
      },
    },
    minify: true,
  },
});