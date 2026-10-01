import { describe, expect, it } from "vitest";
import type { HttpClient } from "../../src/sources/http.ts";
import { centerRedirects, linksBack, type LinksResponse } from "../../src/sources/linksBack.ts";
import { fixture, readJson } from "./fixtures.ts";

interface Recorded {
  center: string;
  aliases: string[];
  checked: string[];
  back: string[];
}

/** A client that answers prop=links from a function, recording every request. */
function fakeClient(answer: (params: URLSearchParams) => unknown) {
  const requests: URLSearchParams[] = [];
  const client: HttpClient = {
    getText: () => Promise.reject(new Error("not used")),
    async getJson<T>(url: string) {
      const params = new URL(url).searchParams;
      requests.push(params);
      return { data: answer(params) as T, url, status: 200, headers: {} };
    },
  };
  return { client, requests };
}

/** Answers from a recorded linksback.json: pages that link back get one link to the center. */
function recordedAnswer(recorded: Recorded) {
  const back = new Set(recorded.back);
  return (params: URLSearchParams): LinksResponse => ({
    query: {
      pages: (params.get("titles") ?? "").split("|").map((title) => ({
        title,
        ...(back.has(title) ? { links: [{ ns: 0, title: recorded.center }] } : {}),
      })),
    },
  });
}

describe("linksBack", () => {
  const recorded = readJson<Recorded>(fixture("en", "Mind map"), "linksback.json");

  it("finds the recorded leaves of Mind map that link back", async () => {
    const { client } = fakeClient(recordedAnswer(recorded));
    const back = await linksBack("en", recorded.center, recorded.checked, {
      client,
      aliases: recorded.aliases,
    });
    expect([...back].sort()).toEqual(recorded.back);
    expect(back.has("Tony Buzan")).toBe(true);
  });

  it("asks about the center and its redirects, 50 titles per request", async () => {
    const titles = Array.from({ length: 120 }, (_, i) => `Leaf ${i}`);
    const { client, requests } = fakeClient(() => ({ query: { pages: [] } }));
    await linksBack("en", "Mind map", [...titles, ...titles], {
      client,
      aliases: ["Mind-map", "Mindmap"],
    });
    expect(requests).toHaveLength(3);
    expect(requests.map((r) => r.get("titles")!.split("|").length)).toEqual([50, 50, 20]);
    expect(requests[0]!.get("pltitles")).toBe("Mind map|Mind-map|Mindmap");
    expect(requests[0]!.get("redirects")).toBe("1");
  });

  it("never asks about the center itself", async () => {
    const { client, requests } = fakeClient(() => ({ query: { pages: [] } }));
    await linksBack("en", "Mind map", ["Mind map", "Chess"], { client });
    expect(requests[0]!.get("titles")).toBe("Chess");
  });

  it("follows plcontinue", async () => {
    const { client, requests } = fakeClient((params) =>
      params.get("plcontinue")
        ? {
            query: { pages: [{ title: "B", links: [{ ns: 0, title: "Center" }] }, { title: "A" }] },
          }
        : {
            continue: { plcontinue: "123|0|Center", continue: "||" },
            query: { pages: [{ title: "A", links: [{ ns: 0, title: "Center" }] }, { title: "B" }] },
          },
    );
    const back = await linksBack("en", "Center", ["A", "B", "C"], { client });
    expect(requests).toHaveLength(2);
    expect(requests[1]!.get("plcontinue")).toBe("123|0|Center");
    expect([...back].sort()).toEqual(["A", "B"]);
  });

  it("maps resolved redirects back to the title that was asked", async () => {
    const { client } = fakeClient(() => ({
      query: {
        normalized: [{ from: "concept maps", to: "Concept maps" }],
        redirects: [{ from: "Concept maps", to: "Concept map" }],
        pages: [{ title: "Concept map", links: [{ ns: 0, title: "Mind map" }] }],
      },
    }));
    const back = await linksBack("en", "Mind map", ["concept maps"], { client });
    expect(back.has("Concept maps")).toBe(true);
    expect(back.has("Concept map")).toBe(true);
  });
});

describe("centerRedirects", () => {
  it("lists the titles that redirect to the center, following continuation", async () => {
    const { client, requests } = fakeClient((params) =>
      params.get("rdcontinue")
        ? { query: { pages: [{ title: "Mind map", redirects: [{ title: "Mindmap" }] }] } }
        : {
            continue: { rdcontinue: "42", continue: "||" },
            query: { pages: [{ title: "Mind map", redirects: [{ title: "Mind-map" }] }] },
          },
    );
    expect(await centerRedirects("en", "Mind map", client)).toEqual(["Mind-map", "Mindmap"]);
    expect(requests[0]!.get("rdnamespace")).toBe("0");
  });
});
