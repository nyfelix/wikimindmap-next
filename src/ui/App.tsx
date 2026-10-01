import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";
import { MapRoute, StartRoute } from "./screens/routes.tsx";

// Editorial pages are their own chunks, with their own fonts.
const AboutPage = lazy(() => import("./editorial/AboutPage.tsx"));
const LensesPage = lazy(() => import("./editorial/LensesPage.tsx"));

// Dev only: tree-shaken from production builds.
const DevFixturePage = import.meta.env.DEV
  ? lazy(() => import("./dev/DevFixturePage.tsx"))
  : undefined;

export function App() {
  return (
    <Suspense>
      <Routes>
        {DevFixturePage && <Route path="/dev/fixture/:lang/:title" element={<DevFixturePage />} />}
        <Route path="/" element={<StartRoute />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/help/lenses" element={<LensesPage />} />
        <Route path="/:lang/:title" element={<MapRoute />} />
        <Route path="*" element={<StartRoute />} />
      </Routes>
    </Suspense>
  );
}
