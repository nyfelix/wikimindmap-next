import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { titleFromPath, titleToPath } from "../../core/titles.ts";
import type { Article, Enrichments } from "../../core/types.ts";
import { getLens } from "../../lenses/index.ts";
import { parseParsoid } from "../../sources/parsoid.ts";
import { redirectPairs } from "../../sources/redirects.ts";
import { parseSiteinfo } from "../../sources/siteinfo.ts";
import { Logo } from "../brand/Logo.tsx";
import { useMapState } from "../hooks/useMapState.ts";
import { MapView } from "../map/MapView.tsx";
import { Attribution } from "../panels/Attribution.tsx";
import panel from "../panels/Panel.module.css";
import { fixtureList, loadFixture } from "./fixtures.ts";
import styles from "./DevFixturePage.module.css";

/** /dev/fixture/:lang/:title renders any recorded fixture, without network (US-01). */
export default function DevFixturePage() {
  const params = useParams();
  const lang = params.lang ?? "en";
  const title = titleFromPath(params.title ?? "");
  const state = useMapState();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState<
    { article: Article; enrichments: Enrichments } | "missing"
  >();

  useEffect(() => {
    let cancelled = false;
    void loadFixture({ lang, title }).then((fixture) => {
      if (cancelled) return;
      if (!fixture) return setLoaded("missing");
      const article = parseParsoid(
        fixture.html,
        { lang, title },
        parseSiteinfo(lang, fixture.siteinfo),
        new DOMParser(),
      );
      const redirects = new Map<string, string>();
      for (const batch of fixture.redirectBatches) {
        const asked = [
          ...(batch.query?.normalized ?? []).map((n) => n.from),
          ...(batch.query?.redirects ?? []).map((r) => r.from),
        ];
        for (const [from, to] of redirectPairs(asked, batch)) redirects.set(from, to);
      }
      setLoaded({ article, enrichments: { redirects } });
    });
    return () => {
      cancelled = true;
    };
  }, [lang, title]);

  const graph = useMemo(
    () =>
      loaded && loaded !== "missing"
        ? getLens(state.lens).build(loaded.article, loaded.enrichments, state.options)
        : undefined,
    [loaded, state.lens, state.options],
  );

  return (
    <div className={styles.screen}>
      {graph && loaded && loaded !== "missing" && (
        <>
          <MapView
            graph={graph}
            mapKey={`${lang}:${title}`}
            state={state}
            actions={{
              // Recentering only works between recorded fixtures here.
              onRecenter: (node) => {
                if (node.target) void navigate(`/dev/fixture/${lang}/${titleToPath(node.target)}`);
              },
            }}
          />
          <Attribution article={loaded.article.ref} />
        </>
      )}
      <div className={`${panel.panel} ${panel.topLeft}`}>
        <Logo height={20} />
        <span className={panel.caps}>Dev fixture</span>
      </div>
      <nav className={`${panel.panel} ${panel.bottomLeft}`} aria-label="Fixtures">
        <span className={panel.caps}>Fixtures</span>
        {fixtureList().map((f) => (
          <Link
            key={`${f.lang}/${f.title}`}
            className={styles.link}
            to={`/dev/fixture/${f.lang}/${titleToPath(f.title)}`}
            aria-current={f.lang === lang && f.title === title ? "page" : undefined}
          >
            {f.lang}:{f.title}
          </Link>
        ))}
      </nav>
      {loaded === "missing" && (
        <p className={styles.missing}>
          No fixture for {lang}:{title}.
        </p>
      )}
    </div>
  );
}
