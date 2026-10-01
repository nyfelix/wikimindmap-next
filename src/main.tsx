import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
// Self-hosted fonts (styleguide.md §8): Zilla Slab 700 + italic, Fira Sans 400/600, Fira Mono
// 500. Each file is split by unicode-range, so only the scripts a page uses are downloaded.
import "@fontsource/zilla-slab/700.css";
import "@fontsource/zilla-slab/700-italic.css";
import "@fontsource/fira-sans/400.css";
import "@fontsource/fira-sans/600.css";
import "@fontsource/fira-mono/500.css";
import { App } from "./ui/App.tsx";
import "./ui/styles/tokens.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from index.html");

createRoot(root).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
