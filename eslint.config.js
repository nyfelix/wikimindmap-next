// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier";
import globals from "globals";

// Layer rules from architecture.md §8: ui → lenses, layouts, sources, core; sources, lenses,
// layouts → core; core → nothing.
const layer = (/** @type {string[]} */ forbidden) =>
  forbidden.map((dir) => ({
    group: [`**/${dir}`, `**/${dir}/**`],
    message: `This layer must not import from src/${dir} (architecture.md §8).`,
  }));
const react = [
  { group: ["react", "react/*", "react-dom", "react-dom/*"], message: "Only src/ui uses React." },
];

// Only src/sources/http.ts talks to the network; pure layers get no DOM globals.
const network = ["fetch", "XMLHttpRequest", "WebSocket", "EventSource"].map((name) => ({
  name,
  message: "Use the client in src/sources/http.ts.",
}));
const dom = ["window", "document", "DOMParser", "localStorage", "sessionStorage", "navigator"].map(
  (name) => ({ name, message: "Pure layers take data and return data (CLAUDE.md)." }),
);

export default tseslint.config(
  {
    ignores: [
      "dist",
      "coverage",
      "playwright-report",
      "test-results",
      "concepts",
      "tests/fixtures",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // Tests may assert on values they know are present.
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-invalid-void-type": "off",
    },
  },
  {
    files: ["src/ui/**/*.{ts,tsx}", "src/main.tsx"],
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/sources/http.ts"],
    rules: { "no-restricted-globals": ["error", ...network] },
  },
  {
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [...layer(["sources", "lenses", "layouts", "ui"]), ...react] },
      ],
      "no-restricted-globals": ["error", ...network, ...dom],
    },
  },
  {
    files: ["src/sources/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [...layer(["lenses", "layouts", "ui"]), ...react] },
      ],
    },
  },
  {
    files: ["src/lenses/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [...layer(["sources", "layouts", "ui"]), ...react] },
      ],
      "no-restricted-globals": ["error", ...network, ...dom],
    },
  },
  {
    files: ["src/layouts/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [...layer(["sources", "lenses", "ui"]), ...react] },
      ],
      "no-restricted-globals": ["error", ...network, ...dom],
    },
  },
  prettier,
);
