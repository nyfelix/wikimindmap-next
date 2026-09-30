import { describe, expect, it, vi } from "vitest";
import {
  API_USER_AGENT,
  actionUrl,
  createHttpClient,
  createLimiter,
  HttpError,
  restUrl,
  titleSegment,
} from "../../src/sources/http.ts";

type FetchArgs = [input: string | URL | Request, init?: RequestInit];

function reply(status: number, body: unknown = {}, url = ""): Response {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  const res = new Response(status === 204 ? null : text, { status });
  if (url) Object.defineProperty(res, "url", { value: url });
  return res;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("URLs", () => {
  it("encodes titles as path segments", () => {
    expect(titleSegment("Python (programming language)")).toBe("Python_(programming_language)");
    expect(titleSegment("Zürich")).toBe("Z%C3%BCrich");
    expect(titleSegment("AC/DC")).toBe("AC%2FDC");
    expect(restUrl("de", `page/${titleSegment("Zürich")}/html`)).toBe(
      "https://de.wikipedia.org/w/rest.php/v1/page/Z%C3%BCrich/html",
    );
  });

  it("builds Action API URLs with JSON format version 2", () => {
    const url = new URL(actionUrl("en", { prop: "pageviews", titles: "A|B" }));
    expect(url.pathname).toBe("/w/api.php");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      action: "query",
      prop: "pageviews",
      titles: "A|B",
      format: "json",
      formatversion: "2",
    });
  });
});

describe("createHttpClient", () => {
  it("sends Api-User-Agent and adds origin=* to api.php only", async () => {
    const fetch = vi.fn(async (..._args: FetchArgs) => reply(200, { ok: true }));
    const client = createHttpClient({ fetch });

    await client.getJson(actionUrl("en", { meta: "siteinfo" }));
    await client.getText(restUrl("en", "page/Mind_map/html"));

    const [apiUrl, apiInit] = fetch.mock.calls[0]!;
    expect(new URL(String(apiUrl)).searchParams.get("origin")).toBe("*");
    expect((apiInit?.headers as Record<string, string>)["Api-User-Agent"]).toBe(API_USER_AGENT);
    const [restCall] = fetch.mock.calls[1]!;
    expect(String(restCall)).not.toContain("origin");
  });

  it("returns the final URL and lower-case headers", async () => {
    const fetch = vi.fn(async () => {
      const res = reply(
        200,
        "<html></html>",
        "https://en.wikipedia.org/w/rest.php/v1/page/Mind_map/html?redirect=no",
      );
      res.headers.set("Content-Type", "text/html; profile=x");
      return res;
    });
    const result = await createHttpClient({ fetch }).getText(restUrl("en", "page/Mindmap/html"));
    expect(result.url).toContain("/page/Mind_map/html");
    expect(result.headers["content-type"]).toBe("text/html; profile=x");
    expect(result.data).toBe("<html></html>");
  });

  it("retries 429 and 503 after 1 s, 2 s and 4 s, then succeeds", async () => {
    const statuses = [429, 503, 429, 200];
    const fetch = vi.fn(async () => reply(statuses.shift()!, { done: true }));
    const sleep = vi.fn(async () => {});
    const result = await createHttpClient({ fetch, sleep }).getJson<{ done: boolean }>(
      "https://en.wikipedia.org/w/api.php",
    );
    expect(result.data.done).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(sleep.mock.calls).toEqual([[1000], [2000], [4000]]);
  });

  it("gives up with RateLimited after the last retry", async () => {
    const fetch = vi.fn(async () => reply(429));
    const sleep = vi.fn(async () => {});
    const error = await createHttpClient({ fetch, sleep })
      .getText("https://en.wikipedia.org/x")
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).kind).toBe("RateLimited");
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("maps statuses and failures to typed errors", async () => {
    const kindFor = async (fetch: () => Promise<Response>) =>
      createHttpClient({ fetch, sleep: async () => {} })
        .getJson("https://en.wikipedia.org/w/api.php")
        .then(
          () => "ok",
          (e: HttpError) => e.kind,
        );

    expect(await kindFor(async () => reply(404))).toBe("NotFound");
    expect(await kindFor(async () => reply(500))).toBe("Unexpected");
    expect(await kindFor(async () => reply(200, "not json"))).toBe("Unexpected");
    expect(await kindFor(async () => Promise.reject(new TypeError("Failed to fetch")))).toBe(
      "Network",
    );
    expect(await kindFor(async () => reply(200, { error: { code: "badvalue" } }))).toBe(
      "Unexpected",
    );
    expect(await kindFor(async () => reply(200, { error: { code: "ratelimited" } }))).toBe(
      "RateLimited",
    );
  });

  it("times out after the configured time", async () => {
    const fetch = vi.fn(
      (_input: FetchArgs[0], init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );
    const error = await createHttpClient({ fetch, timeoutMs: 20 })
      .getText("https://en.wikipedia.org/slow")
      .then(
        () => undefined,
        (e: HttpError) => e,
      );
    expect(error?.kind).toBe("Network");
    expect(error?.message).toContain("timeout");
  });

  it("uses a 15 s timeout by default", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    await createHttpClient({ fetch: async () => reply(200) }).getText("https://en.wikipedia.org/");
    expect(timeout).toHaveBeenCalledWith(15_000);
    timeout.mockRestore();
  });

  it("keeps at most 4 requests in flight", async () => {
    let inFlight = 0;
    let peak = 0;
    const gates: ReturnType<typeof deferred<void>>[] = [];
    const fetch = vi.fn(async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      const gate = deferred<void>();
      gates.push(gate);
      await gate.promise;
      inFlight--;
      return reply(200, "x");
    });
    const client = createHttpClient({ fetch });

    const all = Promise.all(
      Array.from({ length: 10 }, (_, i) => client.getText(`https://en.wikipedia.org/${i}`)),
    );
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(4));
    // Finish the requests one by one; each finished one lets the next start.
    while (fetch.mock.calls.length < 10 || gates.length > 0) {
      gates.shift()?.resolve();
      await new Promise((r) => setTimeout(r, 0));
    }
    await all;

    expect(fetch).toHaveBeenCalledTimes(10);
    expect(peak).toBe(4);
  });

  it("frees the slot while waiting to retry", async () => {
    const first = [503, 200];
    const fetch = vi.fn(async (input: FetchArgs[0]) =>
      String(input).endsWith("/a") ? reply(first.shift()!, "a") : reply(200, "b"),
    );
    const sleepGate = deferred<void>();
    const client = createHttpClient({ fetch, maxInFlight: 1, sleep: () => sleepGate.promise });

    const a = client.getText("https://en.wikipedia.org/a");
    const b = await client.getText("https://en.wikipedia.org/b");
    expect(b.data).toBe("b");
    sleepGate.resolve();
    expect((await a).data).toBe("a");
  });
});

describe("createLimiter", () => {
  it("never exceeds the limit when new tasks arrive as others finish", async () => {
    const run = createLimiter(2);
    let active = 0;
    let peak = 0;
    const task = async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 1));
      active--;
    };
    const first = Array.from({ length: 5 }, () => run(task));
    await first[0];
    await Promise.all([...first, ...Array.from({ length: 5 }, () => run(task))]);
    expect(peak).toBe(2);
  });
});
