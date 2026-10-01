/** The map shown on the start page, per language (datamodel.md §8). */
export const START_TITLES: Record<string, string> = {
  en: "Mind map",
  de: "Mindmap",
  fr: "Carte heuristique",
};

/** The reader's first browser language (its primary subtag), or English. */
export function browserLang(languages: readonly string[] = navigator.languages): string {
  for (const tag of languages) {
    const lang = tag.toLowerCase().split("-")[0];
    if (lang && /^[a-z]{2,3}$/.test(lang)) return lang;
  }
  return "en";
}
