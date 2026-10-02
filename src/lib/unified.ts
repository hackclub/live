// Looks up whether a project has already been shipped to Hack Club Unified,
// by scraping the "bonked" tool's /u search page (it has no JSON API).
// Everything here is best-effort: a lookup that fails reports
// "unavailable" and never blocks the review queue from rendering.

export type UnifiedShip = {
  user: string;
  program: string;
  hours: number;
  approvedAt: string;
};

export type UnifiedInfo =
  | { status: "unavailable" }
  | { status: "none" }
  | { status: "found"; ships: UnifiedShip[]; totalHours: number; searchUrl: string };

const CACHE_TTL_MS = 10 * 60_000;
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_CONCURRENT = 4;

const cache = new Map<string, { expires: number; promise: Promise<UnifiedShip[] | null> }>();

const UNIFIED_BASE_URL = "https://lin6bu84s73ya069zkua89ny.halceon.dev";

function baseUrl(): string {
  return UNIFIED_BASE_URL;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;/g, "'")
    .replace(/&amp;/g, "&");
}

function text(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}

// Cells in a result row, in order: user, program, description, hours, stars,
// country, approved date, links.
function parseShips(html: string): UnifiedShip[] {
  const tbody = /<tbody>([\s\S]*?)<\/tbody>/.exec(html)?.[1] ?? "";
  const ships: UnifiedShip[] = [];
  for (const row of tbody.match(/<tr>[\s\S]*?<\/tr>/g) ?? []) {
    const cells = (row.match(/<td[\s\S]*?<\/td>/g) ?? []).map(text);
    if (cells.length < 7) continue;
    ships.push({
      user: cells[0],
      program: cells[1],
      hours: Number(cells[3]) || 0,
      approvedAt: cells[6],
    });
  }
  return ships;
}

export function unifiedSearchUrl(query: string): string | null {
  const base = baseUrl();
  return base ? `${base}/u?q=${encodeURIComponent(query)}` : null;
}

function fetchShips(query: string): Promise<UnifiedShip[] | null> {
  const cached = cache.get(query);
  if (cached && cached.expires > Date.now()) return cached.promise;

  const url = unifiedSearchUrl(query);
  const promise = (async () => {
    if (!url) return null;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), cache: "no-store" });
      if (!res.ok) return null;
      return parseShips(await res.text());
    } catch {
      return null;
    }
  })();

  cache.set(query, { expires: Date.now() + CACHE_TTL_MS, promise });
  // A failed lookup shouldn't stick for the full TTL.
  void promise.then((result) => {
    if (result === null) cache.delete(query);
  });
  return promise;
}

// Checks every distinct non-empty URL of a project (playable + code).
async function lookupOne(urls: string[]): Promise<UnifiedInfo> {
  if (!baseUrl()) return { status: "unavailable" };
  const results = await Promise.all(urls.map(fetchShips));
  if (results.every((r) => r === null)) return { status: "unavailable" };

  // The same ship can match both URLs, and genuine repeat ships can look
  // identical, so don't merge — take the URL that matched the most ships.
  let best = 0;
  results.forEach((r, i) => {
    if ((r?.length ?? 0) > (results[best]?.length ?? 0)) best = i;
  });
  const ships = results[best] ?? [];
  if (ships.length === 0) return { status: "none" };

  const totalHours = Math.round(ships.reduce((sum, s) => sum + s.hours, 0) * 10) / 10;
  return { status: "found", ships, totalHours, searchUrl: unifiedSearchUrl(urls[best]) ?? "" };
}

// Looks up many records at once with bounded concurrency, keyed by record id.
export async function lookupUnifiedForRecords(
  records: { id: string; urls: string[] }[],
): Promise<Map<string, UnifiedInfo>> {
  const out = new Map<string, UnifiedInfo>();
  const queue = records.slice();
  async function worker() {
    for (let item = queue.shift(); item; item = queue.shift()) {
      const urls = [...new Set(item.urls.map((u) => u.trim()).filter(Boolean))];
      out.set(item.id, urls.length ? await lookupOne(urls) : { status: "none" });
    }
  }
  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT, records.length) }, worker));
  return out;
}
