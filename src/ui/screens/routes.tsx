import { useMemo } from "react";
import { Navigate, useParams } from "react-router";
import { titleFromPath } from "../../core/titles.ts";
import { LiveMapScreen } from "./LiveMapScreen.tsx";
import { browserLang, START_TITLES } from "./start.ts";
import { useQuery } from "@tanstack/react-query";
import { langlinkQuery } from "../data/queries.ts";

/** "/": the map of "Mind map" in the reader's language (datamodel.md §8, US-09). */
export function StartRoute() {
  const wanted = useMemo(() => browserLang(), []);
  const known = START_TITLES[wanted];
  // Other languages: "Mind map" there, via langlinks from the English article.
  const link = useQuery({ ...langlinkQuery("en", "Mind map", wanted), enabled: !known });
  const ref = useMemo(() => {
    if (known) return { lang: wanted, title: known };
    if (link.data) return { lang: wanted, title: link.data };
    return { lang: "en", title: "Mind map" };
  }, [known, wanted, link.data]);
  // Wait briefly for the lookup, so the map doesn't switch language right after appearing.
  if (!known && link.isPending) return null;
  return <LiveMapScreen article={ref} isStart key={`start:${ref.lang}`} />;
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
