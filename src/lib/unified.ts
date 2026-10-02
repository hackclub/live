// Looks up whether a project has already been shipped to Hack Club Unified,
// by scraping the "bonked" tool's /u search page (it has no JSON API).
// Everything here is best-effort: a lookup that fails reports
// "unavailable" and never blocks the review queue from rendering.

export type UnifiedShip = {
  user: string;
  program: string;
  hours: number;
  approvedAt: string;
  // Hrefs in the result row (code/playable/etc.), used to match a submission.
  links: string[];
  // True when this ship's URLs or repo are the submission being reviewed.
  sameProject: boolean;
};

export type UnifiedInfo =
  | { status: "unavailable" }
  | { status: "none" }
  | { status: "found"; ships: UnifiedShip[]; totalHours: number; searchUrl: string; matches: number };

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
      links: [...row.matchAll(/href="([^"]+)"/g)].map((m) => decodeEntities(m[1])),
      sameProject: false,
    });
  }
  return ships;
}

function normalizeUrl(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\.git$/, "")
    .replace(/\/+$/, "");
}

// "https://github.com/Owner/Repo/tree/main" -> "owner/repo"; Unified lists a
// ship's user column as that repo path.
function repoPath(url: string): string | null {
  const m = /^github\.com\/([^/]+)\/([^/?#]+)/.exec(normalizeUrl(url));
  return m ? `${m[1]}/${m[2]}`.replace(/\.git$/, "") : null;
}

// Flags ships that are this exact submission (same code/playable URL or repo),
// so a project resubmitted under another program stands out.
function markSameProject(ships: UnifiedShip[], urls: string[]): void {
  const normalized = new Set(urls.map(normalizeUrl));
  const repos = new Set(urls.map(repoPath).filter((r): r is string => r !== null));
  for (const ship of ships) {
    ship.sameProject =
      repos.has(ship.user.trim().toLowerCase()) ||
      ship.links.some((link) => normalized.has(normalizeUrl(link)) || repos.has(repoPath(link) ?? ""));
  }
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
  // identical, so don't merge — take the URL whose ships include the most
  // exact matches for this submission, then the one that matched the most ships.
  // Ships are shared via the lookup cache, so mark copies, not the originals.
  const candidates = results.map((r, i) => {
    const ships = (r ?? []).map((ship) => ({ ...ship }));
    markSameProject(ships, urls);
    return { ships, url: urls[i], matches: ships.filter((ship) => ship.sameProject).length };
  });
  const bestCandidate = candidates.reduce((a, b) =>
    b.matches > a.matches || (b.matches === a.matches && b.ships.length > a.ships.length) ? b : a,
  );
  const { ships, matches } = bestCandidate;
  if (ships.length === 0) return { status: "none" };

  const totalHours = Math.round(ships.reduce((sum, s) => sum + s.hours, 0) * 10) / 10;
  return {
    status: "found",
    ships,
    totalHours,
    searchUrl: unifiedSearchUrl(bestCandidate.url) ?? "",
    matches,
  };
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
