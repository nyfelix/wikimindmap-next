/** The map shown on the start page, per language (datamodel.md §8). */
export const START_TITLES: Record<string, string> = {
  en: "Mind map",
  de: "Mindmap",
  fr: "Carte heuristique",
};

/** The reader's language if we know its start article, else English (full picker: US-09). */
export function preferredLang(languages: readonly string[] = navigator.languages): string {
  for (const tag of languages) {
    const lang = tag.toLowerCase().split("-")[0];
    if (lang && START_TITLES[lang]) return lang;
  }
  return "en";
}
