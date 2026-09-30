import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// BASE_PATH is "/wikimindmap-next/" on github.io and "/" on a custom domain (architecture.md §7).
const base = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base,
  plugins: [react()],
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
    environment: "happy-dom",
  },
});
