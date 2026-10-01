import { titleToPath } from "../../core/titles.ts";
import type { ArticleRef } from "../../core/types.ts";
import styles from "./Attribution.module.css";

/** Always visible under the map controls (styleguide.md §2, US-12). */
export function Attribution({ article }: { article: ArticleRef }) {
  const href = `https://${article.lang}.wikipedia.org/wiki/${titleToPath(article.title)}`;
  return (
    <a className={styles.attribution} href={href} target="_blank" rel="noopener noreferrer">
      Content from Wikipedia · CC BY-SA
    </a>
  );
}
