import { Link } from "react-router";
import { titleToPath } from "../../core/titles.ts";
import type { ArticleRef } from "../../core/types.ts";
import styles from "./Attribution.module.css";

/**
 * Always visible under the map controls (styleguide.md §2, US-12): the author, linking to About,
 * and the Wikipedia attribution, linking to the article.
 */
export function Attribution({ article }: { article: ArticleRef }) {
  const href = `https://${article.lang}.wikipedia.org/wiki/${titleToPath(article.title)}`;
  return (
    <p className={styles.attribution}>
      <Link to="/about">A project by Felix Nyffenegger</Link>
      <span aria-hidden="true"> · </span>
      <a href={href} target="_blank" rel="noopener noreferrer">
        Content from Wikipedia · CC BY-SA
      </a>
    </p>
  );
}
