import { useMemo } from "react";
import { Navigate, useParams } from "react-router";
import { titleFromPath } from "../../core/titles.ts";
import { LiveMapScreen } from "./LiveMapScreen.tsx";
import { preferredLang, START_TITLES } from "./start.ts";

/** "/": the map of "Mind map" in the reader's language. */
export function StartRoute() {
  const ref = useMemo(() => {
    const lang = preferredLang();
    return { lang, title: START_TITLES[lang] ?? "Mind map" };
  }, []);
  return <LiveMapScreen article={ref} isStart key="start" />;
}

const LANG = /^[a-z]{2,3}(?:-[a-z0-9]+)*$/;

/** "/:lang/:title" (US-05). */
export function MapRoute() {
  const params = useParams();
  const lang = params.lang ?? "";
  const title = titleFromPath(params.title ?? "");
  const ref = useMemo(() => ({ lang, title }), [lang, title]);
  if (!LANG.test(lang) || !title) return <Navigate to="/" replace />;
  // One screen per language, so pan and zoom carry over when recentering.
  return <LiveMapScreen article={ref} key={lang} />;
}
