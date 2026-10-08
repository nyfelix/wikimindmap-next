import { describe, expect, it } from "vitest";
import type { HttpClient } from "../../src/sources/http.ts";
import {
  CAP,
  fetchLinksHere,
  parseLinksHere,
  type BacklinksPages,
  type BacklinksResponse,
} from "../../src/sources/linksHere.ts";
import { fixture, readJson } from "./fixtures.ts";

/** A client that answers from a list of responses, one per request, recording the requests. */
function fakeClient(answers: BacklinksResponse[]) {
  const requests: URLSearchParams[] = [];
  const client: HttpClient = {
    getText: () => Promise.reject(new Error("not used")),
    async getJson<T>(url: string) {
      requests.push(new URL(url).searchParams);
      const data = answers[requests.length - 1] ?? { query: { pages: [] } };
      return { data: data as T, url, status: 200, headers: {} };
    },
  };
  return { client, requests };
}

const page = (title: string, length = 100, extra: object = {}) => ({
  title,
  ns: 0,
  length,
  ...extra,
});

describe("parseLinksHere", () => {
  it("reads the recorded incoming links of Mind map: no redirects, no duplicates", () => {
    const recorded = readJson<BacklinksPages>(fixture("en", "Mind map"), "linkshere.json");
    const here = parseLinksHere(recorded);
    expect(here.capped).toBe(false);
    expect(here.total).toBe(here.titles.length);
    expect(new Set(here.titles).size).toBe(here.titles.length);
    // Redirects to the center ("Mindmap", "Mind mapping") are pages of their own: left out.
    expect(here.titles).not.toContain("Mindmap");
    expect(here.titles).not.toContain("Mind mapping");
    expect(here.titles).toContain("Tony Buzan");
  });

  it("orders the linking articles longest first, ties by title", () => {
    const here = parseLinksHere({
      center: "X",
      more: false,
      responses: [{ query: { pages: [page("B", 10), page("A", 10), page("C", 50)] } }],
    });
    expect(here.titles).toEqual(["C", "A", "B"]);
  });

  it("drops redirect pages, the center and other namespaces, and merges duplicates", () => {
    const here = parseLinksHere({
      center: "X",
      more: false,
      responses: [
        {
          query: {
            pages: [
              page("X-ray", 10, { redirect: true }),
              page("X"),
              page("Talk:X", 10, { ns: 1 }),
              page("A", 10),
            ],
          },
        },
        { query: { pages: [page("A", 10), page("B", 5)] } },
      ],
    });
    expect(here).toEqual({ titles: ["A", "B"], total: 2, capped: false });
  });

  it("caps the total and says so", () => {
    const pages = Array.from({ length: 5 }, (_, i) => page(`P${i}`, i));
    expect(
      parseLinksHere({ center: "X", more: false, responses: [{ query: { pages } }] }, 3),
    ).toEqual({ titles: ["P4", "P3", "P2"], total: 3, capped: true });
    expect(
      parseLinksHere({ center: "X", more: true, responses: [{ query: { pages } }] }).capped,
    ).toBe(true);
  });

  it("reports a capped list for a large article (Albert Einstein)", () => {
    const recorded = readJson<BacklinksPages>(fixture("en", "Albert Einstein"), "linkshere.json");
    const here = parseLinksHere(recorded);
    expect(here.capped).toBe(true);
    expect(here.total).toBe(CAP);
  });
});

describe("fetchLinksHere", () => {
  it("asks for linking articles in namespace 0, through redirects too, with their length", async () => {
    const { client, requests } = fakeClient([{ query: { pages: [page("A")] } }]);
    const pages = await fetchLinksHere("en", "Mind_map", client);
    expect(requests).toHaveLength(1);
    const p = requests[0];
    expect(p?.get("generator")).toBe("backlinks");
    expect(p?.get("gbltitle")).toBe("Mind map");
    expect(p?.get("gblnamespace")).toBe("0");
    expect(p?.get("gblfilterredir")).toBe("nonredirects");
    expect(p?.get("gblredirect")).toBe("1");
    expect(p?.get("prop")).toBe("info");
    expect(pages.more).toBe(false);
  });

  it("follows continuation and stops once the cap is passed", async () => {
    const batch = (from: number) => ({
      continue: { gblcontinue: `0|${from}`, continue: "gblcontinue||" },
      query: { pages: Array.from({ length: 3 }, (_, i) => page(`P${from + i}`)) },
    });
    const { client, requests } = fakeClient([batch(0), batch(3), batch(6), batch(9)]);
    const pages = await fetchLinksHere("en", "X", client, 5);
    expect(requests).toHaveLength(2);
    expect(requests[1]?.get("gblcontinue")).toBe("0|0");
    expect(pages.more).toBe(true);
    expect(parseLinksHere(pages, 5)).toMatchObject({ total: 5, capped: true });
  });
});
