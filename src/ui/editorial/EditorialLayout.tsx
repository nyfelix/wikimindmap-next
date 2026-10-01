// Editorial pages load their own faces (styleguide.md §8): Bricolage for headings, Zilla 400 for text.
import "@fontsource/bricolage-grotesque/700.css";
import "@fontsource/bricolage-grotesque/800.css";
import "@fontsource/zilla-slab/400.css";
import { useEffect, type ReactNode } from "react";
import { Link } from "react-router";
import { Logo } from "../brand/Logo.tsx";
import { GITHUB_URL } from "../brand/links.ts";
import styles from "./Editorial.module.css";

interface Props {
  title: string;
  /** Breadcrumb after "WikiMindMap ›". */
  crumb: string;
  children: ReactNode;
}

/** Pages to read (styleguide.md §14): grey background, reading column, capital eyebrows. */
export function EditorialLayout({ title, crumb, children }: Props) {
  useEffect(() => {
    document.title = `${title} · WikiMindMap`;
  }, [title]);
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className={styles.home} aria-label="WikiMindMap, back to the map">
          <Logo height={24} />
        </Link>
        <nav className={styles.nav} aria-label="Pages">
          <Link to="/about">About</Link>
          <Link to="/help/lenses">Lenses</Link>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <Link to="/" className={styles.back}>
            ← Back to the map
          </Link>
        </nav>
      </header>
      <main className={styles.main}>
        <p className={styles.crumbs}>
          <span className={styles.caps}>WikiMindMap ›</span> <span>{crumb}</span>
        </p>
        {children}
      </main>
      <footer className={styles.footer}>
        <p>
          WikiMindMap is an independent project and is not affiliated with or endorsed by the
          Wikimedia Foundation. Wikipedia is a trademark of the Wikimedia Foundation.
        </p>
      </footer>
    </div>
  );
}

/** A section with its capital eyebrow. */
export function Section({
  eyebrow,
  id,
  children,
}: {
  eyebrow: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.section} {...(id ? { id } : {})}>
      <p className={styles.caps}>{eyebrow}</p>
      {children}
    </section>
  );
}
