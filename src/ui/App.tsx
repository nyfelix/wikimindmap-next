import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";
import { MapRoute, StartRoute } from "./screens/routes.tsx";

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
        <Route path="/:lang/:title" element={<MapRoute />} />
        <Route path="*" element={<StartRoute />} />
      </Routes>
    </Suspense>
  );
}
