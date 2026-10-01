/**
 * The only way to reach Wikimedia (architecture.md §4, "API etiquette"):
 * - sends `Api-User-Agent` on every request
 * - adds `origin=*` to Action API (`api.php`) URLs
 * - keeps at most 4 requests in flight
 * - retries HTTP 429 and 503 after 1 s, 2 s and 4 s
 * - times out each attempt after 15 s
 */

export const API_USER_AGENT = "WikiMindMap/2027 (https://github.com/nyfelix/wikimindmap-next)";

// ── Errors ──────────────────────────────────────────────────────────────────

export type HttpErrorKind = "NotFound" | "RateLimited" | "Network" | "Unexpected";

export class HttpError extends Error {
  readonly kind: HttpErrorKind;
  readonly url: string;
  readonly status: number | undefined;

  constructor(kind: HttpErrorKind, message: string, url: string, status?: number) {
    super(message);
    this.name = kind;
    this.kind = kind;
    this.url = url;
    this.status = status;
  }
}

/** The page or resource does not exist (HTTP 404). */
export class NotFound extends HttpError {
  constructor(url: string) {
    super("NotFound", `Not found: ${url}`, url, 404);
  }
}

/** Still 429 or 503 after all retries. */
export class RateLimited extends HttpError {
  constructor(url: string, status: number) {
    super("RateLimited", `Wikipedia is busy (HTTP ${status}): ${url}`, url, status);
  }
}

/** No response: offline, DNS, CORS or timeout. */
export class Network extends HttpError {
  constructor(url: string, reason: string) {
    super("Network", `Network error (${reason}): ${url}`, url);
  }
}

/** Any other status, an unreadable body, or an Action API error object. */
export class Unexpected extends HttpError {
  constructor(url: string, reason: string, status?: number) {
    super("Unexpected", `Unexpected response (${reason}): ${url}`, url, status);
  }
}

// ── URLs ────────────────────────────────────────────────────────────────────

/** `https://{lang}.wikipedia.org/w/rest.php/v1/{path}` */
export function restUrl(lang: string, path: string): string {
  return `https://${lang}.wikipedia.org/w/rest.php/v1/${path}`;
}

/**
 * Action API URL with `format=json&formatversion=2`. `origin=*` is added by the client.
 * `host` defaults to the Wikipedia of `lang`; Wikimedia-wide lookups use meta.wikimedia.org.
 */
export function actionUrl(
  lang: string,
  params: Record<string, string | number>,
  host = `${lang}.wikipedia.org`,
): string {
  const url = new URL(`https://${host}/w/api.php`);
  url.searchParams.set("action", "query");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  return url.toString();
}

function withOrigin(url: string): string {
  const parsed = new URL(url);
  if (parsed.pathname.endsWith("/api.php") && !parsed.searchParams.has("origin")) {
    parsed.searchParams.set("origin", "*");
    return parsed.toString();
  }
  return url;
}

// ── Client ──────────────────────────────────────────────────────────────────

export interface HttpResult<T> {
  data: T;
  /** Final URL after redirects (rest.php answers a redirect title with 307 to the target). */
  url: string;
  status: number;
  /** Response headers, lower-case names. */
  headers: Record<string, string>;
}

export interface RequestOptions {
  signal?: AbortSignal;
}

export interface HttpClient {
  getText(url: string, options?: RequestOptions): Promise<HttpResult<string>>;
  getJson<T>(url: string, options?: RequestOptions): Promise<HttpResult<T>>;
}

export interface HttpClientOptions {
  fetch?: typeof fetch;
  maxInFlight?: number;
  retryDelaysMs?: readonly number[];
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  /** Extra headers, e.g. `User-Agent` for the Node fixture recorder (browsers forbid it). */
  headers?: Record<string, string>;
}

const RETRY_STATUS = new Set([429, 503]);

export function createHttpClient(options: HttpClientOptions = {}): HttpClient {
  const fetchFn = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  const retryDelays = options.retryDelaysMs ?? [1000, 2000, 4000];
  const timeoutMs = options.timeoutMs ?? 15_000;
  const sleep = options.sleep ?? ((ms) => new Promise<void>((done) => setTimeout(done, ms)));
  const limit = createLimiter(options.maxInFlight ?? 4);
  const headers = { ...options.headers, "Api-User-Agent": API_USER_AGENT };

  /** One attempt: holds a slot until the body has been read. */
  async function attempt<T>(
    url: string,
    read: (res: Response) => Promise<T>,
    signal: AbortSignal | undefined,
  ): Promise<HttpResult<T> | { retry: number }> {
    return limit(async () => {
      const timeout = AbortSignal.timeout(timeoutMs);
      const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
      let res: Response;
      try {
        res = await fetchFn(url, { headers, signal: combined });
      } catch (error) {
        if (signal?.aborted) throw error;
        throw new Network(url, timeout.aborted ? "timeout" : describe(error));
      }
      if (RETRY_STATUS.has(res.status)) return { retry: res.status };
      if (res.status === 404) throw new NotFound(url);
      if (!res.ok) throw new Unexpected(url, `HTTP ${res.status}`, res.status);
      let data: T;
      try {
        data = await read(res);
      } catch (error) {
        if (signal?.aborted) throw error;
        if (timeout.aborted) throw new Network(url, "timeout");
        throw new Unexpected(url, `unreadable body: ${describe(error)}`, res.status);
      }
      return { data, url: res.url || url, status: res.status, headers: headerRecord(res.headers) };
    });
  }

  async function request<T>(
    rawUrl: string,
    read: (res: Response) => Promise<T>,
    options: RequestOptions = {},
  ): Promise<HttpResult<T>> {
    const url = withOrigin(rawUrl);
    for (let i = 0; ; i++) {
      const result = await attempt(url, read, options.signal);
      if (!("retry" in result)) return result;
      const delay = retryDelays[i];
      if (delay === undefined) throw new RateLimited(url, result.retry);
      await sleep(delay);
      options.signal?.throwIfAborted();
    }
  }

  return {
    getText: (url, opts) => request(url, (res) => res.text(), opts),
    async getJson<T>(url: string, opts?: RequestOptions) {
      const result = await request(url, (res) => res.json() as Promise<T>, opts);
      checkActionError(result.url, result.data);
      return result;
    },
  };
}

/** The Action API reports errors with HTTP 200 and an `error` object. */
function checkActionError(url: string, data: unknown): void {
  if (typeof data !== "object" || data === null || !("error" in data)) return;
  const error = (data as { error: { code?: string; info?: string } }).error;
  if (error.code === "ratelimited" || error.code === "maxlag") throw new RateLimited(url, 429);
  throw new Unexpected(url, `API error ${error.code ?? "?"}: ${error.info ?? ""}`.trim());
}

function headerRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, name) => {
    record[name.toLowerCase()] = value;
  });
  return record;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Runs at most `max` tasks at once; the rest wait in order. */
export function createLimiter(max: number) {
  let active = 0;
  const waiting: (() => void)[] = [];

  return async function run<T>(task: () => Promise<T>): Promise<T> {
    // A finished task hands its slot straight to the next waiter, so `active` never overshoots.
    if (active >= max) await new Promise<void>((resume) => waiting.push(resume));
    else active++;
    try {
      return await task();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
}

/** The shared client used by the app. */
export const http: HttpClient = createHttpClient();
