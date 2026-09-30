/**
 * Headings hidden by default, per language (datamodel.md §7). Matched case-insensitively against
 * the full heading. Unknown languages fall back to `en`.
 */
import type { Lang } from "./types.ts";

export const HOUSEKEEPING: Readonly<Record<Lang, readonly string[]>> = {
  en: [
    "See also",
    "References",
    "Notes",
    "Footnotes",
    "Citations",
    "Sources",
    "Bibliography",
    "Further reading",
    "External links",
  ],
  de: ["Siehe auch", "Einzelnachweise", "Anmerkungen", "Literatur", "Weblinks", "Quellen"],
  fr: ["Voir aussi", "Notes et références", "Références", "Bibliographie", "Liens externes"],
};

const lookup = new Map(
  Object.entries(HOUSEKEEPING).map(([lang, headings]) => [lang, new Set(headings.map(key))]),
);

function key(heading: string): string {
  return heading.replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

export function isHousekeeping(lang: Lang, heading: string): boolean {
  const headings = lookup.get(lang) ?? lookup.get("en");
  return headings?.has(key(heading)) ?? false;
}
