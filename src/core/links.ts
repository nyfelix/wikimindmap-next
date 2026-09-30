/**
 * Link helpers shared by the lenses: redirect resolution and deduplication (datamodel.md §1:
 * a leaf's identity is its title after resolving redirects).
 */
import type { Article, LinkOccurrence, Section, Title } from "./types.ts";

/** The title a link stands for, after redirects. */
export function resolvedTarget(link: LinkOccurrence, redirects: Map<Title, Title>): Title {
  return redirects.get(link.target) ?? link.target;
}

/** Every distinct target flagged as a redirect in the article: the input for the lookup. */
export function redirectTargets(article: Article): Title[] {
  const targets = new Set<Title>();
  const visit = (section: Section) => {
    for (const link of section.links) if (link.redirect) targets.add(link.target);
    section.children.forEach(visit);
  };
  visit(article.lead);
  article.sections.forEach(visit);
  return [...targets];
}

export interface UniqueLink {
  /** Title after redirects. */
  target: Title;
  /** All occurrences, in reading order; the first decides the position. */
  occurrences: LinkOccurrence[];
}

/**
 * Merges links that lead to the same article once redirects are resolved (`Concept maps` and
 * `Concept map` become one), in order of first occurrence. Links that resolve to `exclude`
 * (usually the center article) are dropped.
 */
export function uniqueLinks(
  links: readonly LinkOccurrence[],
  redirects: Map<Title, Title>,
  exclude?: Title,
): UniqueLink[] {
  const byTarget = new Map<Title, UniqueLink>();
  for (const link of [...links].sort((a, b) => a.order - b.order)) {
    const target = resolvedTarget(link, redirects);
    if (target === exclude) continue;
    const entry = byTarget.get(target);
    if (entry) entry.occurrences.push(link);
    else byTarget.set(target, { target, occurrences: [link] });
  }
  return [...byTarget.values()];
}
