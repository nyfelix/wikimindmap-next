import { copyFile } from "node:fs/promises";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";

// BASE_PATH is "/wikimindmap-next/" on github.io and "/" on a custom domain (architecture.md §7).
const base = process.env.BASE_PATH ?? "/";

/** GitHub Pages has no rewrites: serving index.html as 404.html lets deep links load the app. */
function spaFallback(): Plugin {
  let outDir = "dist";
  return {
    name: "spa-404-fallback",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    async closeBundle() {
      await copyFile(join(outDir, "index.html"), join(outDir, "404.html"));
    },
  };
}

export default defineConfig({
  base,
  plugins: [react(), spaFallback()],
  // Listen on all addresses: VS Code forwards ports from the dev container via 127.0.0.1, and
  // "localhost" alone makes Vite listen on [::1] only, so the page never loads.
  server: { host: true },
  preview: { host: true },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
    environment: "happy-dom",
  },
});
