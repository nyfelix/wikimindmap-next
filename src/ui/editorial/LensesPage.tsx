import { useEffect } from "react";
import { useLocation } from "react-router";
import { lenses, LENS_ORDER } from "../../lenses/index.ts";
import { DirectionIcon } from "../map/DirectionGlyph.tsx";
import styles from "./Editorial.module.css";
import { EditorialLayout, Section } from "./EditorialLayout.tsx";

/** Longer descriptions of every lens, built or coming. */
const ABOUT: Record<string, string[]> = {
  chapters: [
    "The 2007 map. The article’s introduction and chapters become branches, subchapters thinner branches, and the links in their text become leaves.",
    "Infoboxes, footnotes and navigation boxes are left out, and so are “See also” and similar chapters, unless you switch them on.",
  ],
  kinds: [
    "The same links, grouped by what they are: people, organisations, works, events, places and concepts. Six fixed branches in fixed places, so every map reads the same way.",
    "Leaves are ranked by how often they are read on Wikipedia.",
  ],
  links: [
    "Where a topic comes from and where it leads: the articles that link here on one side, the ones it links to on the other, and those that go both ways on top.",
  ],
  metro: [
    "The ideas that run through a long article. A line is an article that is linked from several chapters; the chapters are its stations.",
  ],
};

/** "How lenses work" (US-18, US-20): what each lens shows, and the symbols. */
export default function LensesPage() {
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  return (
    <EditorialLayout title="How lenses work" crumb="How lenses work">
      <header className={styles.section}>
        <h1>How lenses work</h1>
        <p className={styles.lede}>
          A lens is a way to group an article’s links into branches. The article stays the same; the
          lens decides what the branches are. Switch lenses in the top right of the map.
        </p>
      </header>

      {LENS_ORDER.map((l) => (
        <Section key={l.id} id={l.id} eyebrow={lenses[l.id] ? "Lens" : "Lens · coming"}>
          <h2>
            {l.label}
            {!lenses[l.id] && <span className={styles.soon}>Soon</span>}
          </h2>
          {(ABOUT[l.id] ?? [l.description]).map((p) => (
            <p key={p}>{p}</p>
          ))}
        </Section>
      ))}

      <Section eyebrow="Symbols" id="symbols">
        <h2>Which way a link goes</h2>
        <p>
          Every leaf shows the direction of its link. Shape and fill carry the meaning, not just
          color.
        </p>
        <div className={styles.legend}>
          <div>
            <DirectionIcon direction="out" />
            <span>Out: this article links there, but that one doesn’t link back.</span>
          </div>
          <div>
            <DirectionIcon direction="both" />
            <span>Both ways: the two articles link each other.</span>
          </div>
          <div>
            <DirectionIcon direction="in" />
            <span>In: that article links here (Links in / out lens).</span>
          </div>
          <div>
            <DirectionIcon direction="pending" />
            <span>Not checked yet: the direction is still loading.</span>
          </div>
        </div>
      </Section>

      <Section eyebrow="Keyboard">
        <h2>Shortcuts</h2>
        <ul>
          <li>
            <b>/</b> search · <b>?</b> label the map · <b>i</b> how this map is built · <b>o</b>{" "}
            outline
          </li>
          <li>
            <b>+ −</b> zoom · <b>0</b> fit · <b>arrow keys</b> move between nodes · <b>Esc</b> close
          </li>
        </ul>
      </Section>
    </EditorialLayout>
  );
}
