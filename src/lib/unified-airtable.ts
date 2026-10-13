// Read-only access to the Unified YSWS "Approved Projects" Airtable table —
// the cross-YSWS database HQ funds us from. (Not to be confused with
// unified.ts, which scrapes a search page for the review queue's per-project
// lookups; this reads the source table directly for the fulfillment dashboard.) Separate base and PAT from the Live
// base in airtable.ts, so it gets its own cache and throttle: Airtable rate
// limits per base, and sharing airtable.ts's queue would make these reads eat
// Live-base slots for no reason.
const AIRTABLE_API_BASE = "https://api.airtable.com/v0";

// The YSWS name Live's records carry in the `YSWS–Name` rollup.
const LIVE_YSWS_NAME = "Live";

const UNIFIED_FIELDS = {
  yswsName: "YSWS–Name",
  email: "Email",
  hoursSpent: "Hours Spent",
  codeUrl: "Code URL",
  playableUrl: "Playable URL",
  approvedAt: "Approved At",
  justification: "Override Hours Spent Justification",
} as const;

export type UnifiedProject = {
  id: string;
  email: string;
  hours: number;
  codeUrl: string;
  playableUrl: string;
  approvedAt: string;
  justification: string;
};

function unifiedConfig() {
  const apiKey = process.env.UNIFIED_PAT;
  const baseId = process.env.UNIFIED_APP_NAME;
  const tableName = process.env.UNIFIED_TABLE_NAME;
  if (!apiKey || !baseId || !tableName) return null;
  return { apiKey, baseId, tableName };
}

// Link to a Unified record in the Airtable UI, or null when unconfigured.
export function unifiedRecordUrl(recordId: string): string | null {
  const config = unifiedConfig();
  if (!config) return null;
  return `https://airtable.com/${config.baseId}/${config.tableName}/${recordId}`;
}

// Unified changes slowly (HQ syncs in batches), so a minute of staleness is
// free and saves a two-page scan on every dashboard load and snapshot open.
const CACHE_TTL_MS = 60_000;
let cached: { expires: number; promise: Promise<UnifiedProject[] | null> } | null = null;

// Same sliding-window pace as airtable.ts, but its own window for this base.
const MAX_REQUESTS_PER_SECOND = 4;
const requestTimestamps: number[] = [];
let throttleQueue: Promise<void> = Promise.resolve();

function waitForSlot(): Promise<void> {
  const acquire = throttleQueue.then(async () => {
    for (;;) {
      const now = Date.now();
      while (requestTimestamps.length && now - requestTimestamps[0] >= 1000) {
        requestTimestamps.shift();
      }
      if (requestTimestamps.length < MAX_REQUESTS_PER_SECOND) {
        requestTimestamps.push(now);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 - (now - requestTimestamps[0]) + 5));
    }
  });
  throttleQueue = acquire.catch(() => {});
  return acquire;
}

async function fetchLiveUnifiedProjects(): Promise<UnifiedProject[] | null> {
  const config = unifiedConfig();
  if (!config) return null;

  type UnifiedRecord = { id: string; fields: Record<string, unknown> };
  const records: UnifiedRecord[] = [];
  let offset: string | undefined;
  try {
    do {
      const params = new URLSearchParams();
      // FIND narrows server-side; the exact-name check below drops lookalikes
      // such as "Lively" that FIND would also match.
      params.set("filterByFormula", `FIND('${LIVE_YSWS_NAME}', ARRAYJOIN({${UNIFIED_FIELDS.yswsName}}))`);
      for (const field of Object.values(UNIFIED_FIELDS)) params.append("fields[]", field);
      params.set("pageSize", "100");
      if (offset) params.set("offset", offset);
      await waitForSlot();
      const res = await fetch(
        `${AIRTABLE_API_BASE}/${config.baseId}/${encodeURIComponent(config.tableName)}?${params.toString()}`,
        { headers: { Authorization: `Bearer ${config.apiKey}` }, cache: "no-store" },
      );
      if (!res.ok) {
        console.error("[unified] request failed", res.status, await res.text());
        return null;
      }
      const data = (await res.json()) as { records: UnifiedRecord[]; offset?: string };
      records.push(...data.records);
      offset = data.offset;
    } while (offset);
  } catch (err) {
    console.error("[unified] request failed", err);
    return null;
  }

  return records
    .filter((record) => {
      const names = record.fields[UNIFIED_FIELDS.yswsName];
      return Array.isArray(names) && names.includes(LIVE_YSWS_NAME);
    })
    .map((record) => {
      const hours = record.fields[UNIFIED_FIELDS.hoursSpent];
      return {
        id: record.id,
        email: String(record.fields[UNIFIED_FIELDS.email] ?? ""),
        hours: typeof hours === "number" ? hours : 0,
        codeUrl: String(record.fields[UNIFIED_FIELDS.codeUrl] ?? ""),
        playableUrl: String(record.fields[UNIFIED_FIELDS.playableUrl] ?? ""),
        approvedAt: String(record.fields[UNIFIED_FIELDS.approvedAt] ?? ""),
        justification: String(record.fields[UNIFIED_FIELDS.justification] ?? "").trim(),
      };
    });
}

// Every Live record in Unified, or null when Unified isn't configured or
// can't be reached — callers must treat null as "unknown", not "empty".
export function listLiveUnifiedProjects(): Promise<UnifiedProject[] | null> {
  if (cached && cached.expires > Date.now()) return cached.promise;
  const promise = fetchLiveUnifiedProjects();
  cached = { expires: Date.now() + CACHE_TTL_MS, promise };
  // Don't hold a failure for the full TTL.
  promise.then((result) => {
    if (result === null && cached?.promise === promise) cached = null;
  });
  return promise;
}
