import { describe, expect, it } from "vitest";
import {
  isArticle,
  namespaceOf,
  normalizeTitle,
  parseHref,
  titleFromPath,
  titleToPath,
} from "../../src/core/titles.ts";
import { isHousekeeping } from "../../src/core/housekeeping.ts";
import { parseSiteinfo, type SiteinfoResponse } from "../../src/sources/siteinfo.ts";
import enSiteinfo from "../fixtures/en/siteinfo.json";
import deSiteinfo from "../fixtures/de/siteinfo.json";

const en = parseSiteinfo("en", enSiteinfo as SiteinfoResponse);
const de = parseSiteinfo("de", deSiteinfo as SiteinfoResponse);

describe("URL ↔ title", () => {
  it.each([
    ["Mind map", "Mind_map"],
    ["Zürich", "Z%C3%BCrich"],
    ["Python (programming language)", "Python_(programming_language)"],
    ["AC/DC", "AC%2FDC"],
    ["Why Socialism?", "Why_Socialism%3F"],
  ])("%s ↔ %s", (title, path) => {
    expect(titleToPath(title)).toBe(path);
    expect(titleFromPath(path)).toBe(title);
  });

  it("reads unencoded and lower-case paths", () => {
    expect(titleFromPath("Zürich")).toBe("Zürich");
    expect(titleFromPath("mind_map")).toBe("Mind map");
    expect(titleFromPath("100%_pure")).toBe("100% pure");
  });
});

describe("normalizeTitle", () => {
  it("turns underscores into spaces and collapses whitespace", () => {
    expect(normalizeTitle("  Tony__Buzan ")).toBe("Tony Buzan");
  });

  it("upper-cases the first letter, including umlauts", () => {
    expect(normalizeTitle("ärger")).toBe("Ärger");
    expect(normalizeTitle("éclair")).toBe("Éclair");
  });

  it("keeps a first letter whose capital is longer", () => {
    expect(normalizeTitle("ß")).toBe("ß");
  });
});

describe("parseHref", () => {
  it("splits target and fragment", () => {
    expect(parseHref("./Tony_Buzan#Early_life")).toEqual({
      target: "Tony Buzan",
      fragment: "Early life",
    });
  });

  it("decodes percent-encoding and keeps parentheses", () => {
    expect(parseHref("./Python_(programming_language)")).toEqual({
      target: "Python (programming language)",
    });
    expect(parseHref("./Why_Socialism%3F")).toEqual({ target: "Why Socialism?" });
    expect(parseHref("./Z%C3%BCrich")).toEqual({ target: "Zürich" });
    expect(parseHref("./Zürich")).toEqual({ target: "Zürich" });
  });

  it("keeps question marks in fragments", () => {
    expect(parseHref("./Chess_annotation_symbols#?!")).toEqual({
      target: "Chess annotation symbols",
      fragment: "?!",
    });
  });

  it("drops the red-link query", () => {
    expect(parseHref("./Mindnode?action=edit&redlink=1")).toEqual({ target: "Mindnode" });
  });

  it("drops an empty fragment", () => {
    expect(parseHref("./Kategorie:Zürich#%20")).toEqual({ target: "Kategorie:Zürich" });
  });

  it("ignores anything that isn't a ./ link", () => {
    expect(parseHref("https://example.org/")).toBeUndefined();
    expect(parseHref("#cite_note-1")).toBeUndefined();
    expect(parseHref("./")).toBeUndefined();
  });
});

describe("namespaces", () => {
  it("recognizes File: and its local names", () => {
    expect(namespaceOf("File:Mindmap.png", en)).toBe(6);
    expect(namespaceOf("Datei:Mindmap.png", de)).toBe(6);
    expect(namespaceOf("File:Mindmap.png", de)).toBe(6);
    expect(namespaceOf("Bild:Mindmap.png", de)).toBe(6);
  });

  it("matches namespace names case-insensitively and with underscores", () => {
    expect(namespaceOf("kategorie:Zürich", de)).toBe(14);
    expect(namespaceOf("Template_talk:Foo", en)).toBe(11);
  });

  it("treats unknown prefixes as articles", () => {
    expect(isArticle("Mount Everest", en)).toBe(true);
    expect(isArticle("Star Wars: Episode IV", en)).toBe(true);
    expect(isArticle(":Leading colon", en)).toBe(true);
    expect(isArticle("Kategorie:Zürich", de)).toBe(false);
    expect(isArticle("Kategorie:Zürich", en)).toBe(true);
    expect(isArticle("Wikipedia:About", en)).toBe(false);
    expect(isArticle("WP:NPOV", en)).toBe(false);
  });
});

describe("housekeeping", () => {
  it("matches full headings case-insensitively per language", () => {
    expect(isHousekeeping("en", "See also")).toBe(true);
    expect(isHousekeeping("en", "external  links")).toBe(true);
    expect(isHousekeeping("de", "Einzelnachweise")).toBe(true);
    expect(isHousekeeping("fr", "Notes et références")).toBe(true);
    expect(isHousekeeping("en", "See also the history")).toBe(false);
    expect(isHousekeeping("de", "See also")).toBe(false);
  });

  it("falls back to en for unknown languages", () => {
    expect(isHousekeeping("it", "References")).toBe(true);
  });
});
