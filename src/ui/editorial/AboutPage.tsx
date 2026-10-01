import { OLD_REPO_URL, GITHUB_URL } from "../brand/links.ts";
import styles from "./Editorial.module.css";
import { EditorialLayout, Section } from "./EditorialLayout.tsx";

/** About (US-12): the idea, the 2007 history, sources and licences. */
export default function AboutPage() {
  return (
    <EditorialLayout title="About" crumb="About">
      <header className={styles.section}>
        <h1>Wikipedia, as a map</h1>
        <p className={styles.lede}>
          Type a term, and its Wikipedia article becomes the center of a mind map. The article’s
          chapters become branches and its links become leaves. Tap ⊕ on any leaf to make it the new
          center, and wander through the encyclopedia one map at a time.
        </p>
      </header>

      <Section eyebrow="The idea">
        <h2>An overview before you read</h2>
        <p>
          Wikipedia articles have become rich and long. WikiMindMap shows how an article is built
          and where it leads, at a glance: which chapters it has, which articles each chapter links
          to, and which of those link back. It doesn’t replace reading the article; it helps you
          decide where to start, and where to go next.
        </p>
      </Section>

      <Section eyebrow="Then and now">
        <h2>Since 2007</h2>
        <p>
          The first WikiMindMap went online in 2007, written by Felix Nyffenegger. A PHP script read
          a wiki page and turned its headings and links into a mind map, and an adapted version of
          the FreeMind Flash browser by Juan Pedro de Andres drew it. It worked with Wikipedia and
          other MediaWiki wikis, and its source code was published under the GNU GPL.
        </p>
        <p>
          Flash is gone, and Wikipedia has changed a lot since then. This relaunch keeps the idea
          and the recentering gesture, and rebuilds everything else: it runs entirely in your
          browser, reads Wikipedia’s structured article format, and adds lenses: different ways to
          group an article’s links.
        </p>
        <div className={styles.cards}>
          <div className={styles.card}>
            <p className={styles.caps}>2007</p>
            <p>PHP on a server, a Flash mind map, chapters and links.</p>
          </div>
          <div className={styles.card}>
            <p className={styles.caps}>Today</p>
            <p>
              A web app without a server of its own: chapters, link directions, a trail of where you
              have been, and more lenses to come.
            </p>
          </div>
        </div>
        <p>
          The original source is on <a href={OLD_REPO_URL}>GitHub</a>, and so is the{" "}
          <a href={GITHUB_URL}>source of this relaunch</a>.
        </p>
      </Section>

      <Section eyebrow="Data and licences">
        <h2>Where the content comes from</h2>
        <p>
          Every map is built live from <a href="https://www.wikipedia.org/">Wikipedia</a> through
          the public Wikimedia APIs. Article text, summaries and pictures belong to their authors
          and are available under the{" "}
          <a href="https://creativecommons.org/licenses/by-sa/4.0/">
            Creative Commons Attribution-ShareAlike licence (CC BY-SA)
          </a>
          ; each map links to its article. Images come from Wikimedia Commons under their own
          licences.
        </p>
        <p>
          WikiMindMap has no accounts, no cookies and no analytics. Apart from the requests to
          Wikipedia, nothing leaves your browser; recently visited maps are kept in your browser’s
          storage so going back is instant.
        </p>
      </Section>

      <Section eyebrow="Independent">
        <p>
          WikiMindMap is an independent project and is not affiliated with or endorsed by the
          Wikimedia Foundation. Wikipedia is a trademark of the Wikimedia Foundation.
        </p>
      </Section>
    </EditorialLayout>
  );
}
