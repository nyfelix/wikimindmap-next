import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";
import styles from "./App.module.css";

// Dev only: tree-shaken from production builds.
const DevFixturePage = import.meta.env.DEV
  ? lazy(() => import("./dev/DevFixturePage.tsx"))
  : undefined;

function Placeholder() {
  return (
    <main className={styles.placeholder}>
      <p className={styles.eyebrow}>Relaunch in progress</p>
      <h1 className={styles.title}>WikiMindMap</h1>
      <p className={styles.lede}>Browse Wikipedia as a mind map. Coming back soon.</p>
      {import.meta.env.DEV && (
        <a className={styles.lede} href={`${import.meta.env.BASE_URL}dev/fixture/en/Mind_map`}>
          Dev: open a fixture map
        </a>
      )}
    </main>
  );
}

export function App() {
  return (
    <Suspense>
      <Routes>
        {DevFixturePage && <Route path="/dev/fixture/:lang/:title" element={<DevFixturePage />} />}
        <Route path="*" element={<Placeholder />} />
      </Routes>
    </Suspense>
  );
}
