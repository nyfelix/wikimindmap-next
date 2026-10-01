import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router";
// Self-hosted fonts (styleguide.md §8): Zilla Slab 700 + italic, Fira Sans 400/600, Fira Mono
// 500. Each file is split by unicode-range, so only the scripts a page uses are downloaded.
import "@fontsource/zilla-slab/700.css";
import "@fontsource/zilla-slab/700-italic.css";
import "@fontsource/fira-sans/400.css";
import "@fontsource/fira-sans/600.css";
import "@fontsource/fira-mono/500.css";
import { App } from "./ui/App.tsx";
import { queryClient } from "./ui/data/cache.ts";
import { ErrorBoundary } from "./ui/ErrorBoundary.tsx";
import "./ui/styles/tokens.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from index.html");

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
