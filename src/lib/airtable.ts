const AIRTABLE_API_BASE = "https://api.airtable.com/v0";
const AIRTABLE_CONTENT_BASE = "https://content.airtable.com/v0";

// Confirmed against the live base schema (table "YSWS Project Submission",
// tbl4K92vv61uwMeI3) via the Airtable meta API.
export const SUBMISSION_FIELDS = {
  codeUrl: "Code URL",
  playableUrl: "Playable URL",
  firstName: "First Name",
  lastName: "Last Name",
  email: "Email",
  screenshot: "Screenshot",
  description: "Description",
  githubUsername: "GitHub Username",
  addressLine1: "Address (Line 1)",
  addressLine2: "Address (Line 2)",
  city: "City",
  state: "State / Province",
  country: "Country",
  zip: "ZIP / Postal Code",
  birthday: "Birthday",
  overrideHours: "Optional - Override Hours Spent",
  overrideHoursJustification: "Optional - Override Hours Spent Justification",
  hackatimeId: "Justification - Submitter Hackatime ID",
  hackatimeProjects: "Justification - Hackatime Project Name(s) + Date Range(s)",
  lapseLinks: "Justification - Lapse Links, comma-separated",
  // Added by this change — must exist in Airtable before use (see tasks.md 1.1).
  approved: "Approved",
  reviewStatus: "Review Status",
  reviewedAt: "Reviewed At",
  reviewedBy: "Reviewed By",
  // Reviewer precheck fields — distinct from the admin's final fields above.
  // Written only by the `precheck` action; never read by countApprovedHours,
  // payReferral, or anything else that treats a submission as finalized.
  reviewerVerdict: "Reviewer Verdict",
  reviewerJustification: "Reviewer Justification",
  reviewerHours: "Reviewer Hours",
  reviewerReviewedBy: "Reviewer Reviewed By",
  reviewerReviewedAt: "Reviewer Reviewed At",
} as const;

// Shared field list for the /admin and /review queue's full-table scan
// (duplicate-code-URL detection + stats, done across every status). Both
// pages fetch with this exact same array, in the same order, on purpose:
// it makes their listSubmissions(undefined, ...) calls build the identical
// querystring, so they land on the same GET-cache entry below instead of
// each page running its own near-identical full scan — this plus the cache
// itself is what keeps us under Airtable's per-base rate limit when an
// admin and a reviewer are both working the queue at once.
export const SUBMISSION_QUEUE_FIELDS = [
  SUBMISSION_FIELDS.hackatimeId,
  SUBMISSION_FIELDS.hackatimeProjects,
  SUBMISSION_FIELDS.overrideHours,
  SUBMISSION_FIELDS.overrideHoursJustification,
  SUBMISSION_FIELDS.description,
  SUBMISSION_FIELDS.codeUrl,
  SUBMISSION_FIELDS.playableUrl,
  SUBMISSION_FIELDS.lapseLinks,
  SUBMISSION_FIELDS.screenshot,
  SUBMISSION_FIELDS.approved,
  SUBMISSION_FIELDS.reviewStatus,
  SUBMISSION_FIELDS.reviewerVerdict,
  SUBMISSION_FIELDS.reviewerJustification,
  SUBMISSION_FIELDS.reviewerHours,
  SUBMISSION_FIELDS.reviewerReviewedBy,
  SUBMISSION_FIELDS.email,
];

export const REVIEW_STATUS = {
  pending: "Pending",
  rejected: "Rejected",
  fraud: "Fraud",
} as const;

// Added by this change — must exist in Airtable before use (see tasks.md 1.2).
const MESSAGE_FIELDS = {
  submission: "Submission",
  sender: "Sender",
  message: "Message",
  sentAt: "Sent At",
} as const;

export const MESSAGE_SENDER = {
  admin: "Admin",
  submitter: "Submitter",
} as const;

export const REDEMPTION_FIELDS = {
  email: "Email",
  itemName: "Item Name",
  cost: "Cost",
  redeemedAt: "Redeemed At",
} as const;

// Key/value "Stream Config" table — see tasks.md 1.1. One row per setting.
const CONFIG_FIELDS = {
  key: "Key",
  value: "Value",
} as const;

// The single config row that holds the manual /obs-timer offset in minutes.
const TIMER_ADJUSTMENT_KEY = "timerAdjustmentMinutes";

// Referral program — see add-referral-program. One `Referrals` row per referee,
// plus a lazy `Referral Resolutions` map so a referrer handle (GitHub username)
// can be turned into an email at payout time.
export const REFERRAL_FIELDS = {
  refereeEmail: "Referee Email",
  referrerHandle: "Referrer Handle",
  referrerEmail: "Referrer Email",
  source: "Source",
  status: "Status",
  boundAt: "Bound At",
  paidAt: "Paid At",
  refereeSubmission: "Referee Submission",
  redemption: "Redemption",
} as const;

const REFERRAL_RESOLUTION_FIELDS = {
  handle: "Handle",
  email: "Email",
} as const;

// Banned Users — see add-admin-user-ban. One row per banned HCA email; the
// only place a person's ban status lives (never denormalized onto their
// Submission records).
export const BANNED_USER_FIELDS = {
  email: "Email",
  bannedAt: "Banned At",
  bannedBy: "Banned By",
  reason: "Reason",
} as const;

export const REFERRAL_STATUS = {
  pending: "pending",
  paid: "paid",
  void: "void",
} as const;

export const REFERRAL_SOURCE = {
  link: "link",
  code: "code",
} as const;

function submissionTableConfig() {
  const apiKey = process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_TABLE_NAME;
  if (!apiKey || !baseId || !tableName) {
    throw new Error("Airtable env vars are not configured");
  }
  return { apiKey, baseId, tableName };
}

function messagesTableConfig() {
  const apiKey = process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_MESSAGES_TABLE_NAME;
  if (!apiKey || !baseId || !tableName) {
    throw new Error("Airtable messages env vars are not configured");
  }
  // Writes invalidate the table's cache, so a longer window is safe — and the
  // queue now only scans messages lazily when a row's thread is opened.
  return { apiKey, baseId, tableName, cacheTtlMs: 60_000 };
}

function redemptionsTableConfig() {
  const apiKey = process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_REDEMPTIONS_TABLE_NAME;
  if (!apiKey || !baseId || !tableName) {
    throw new Error("Airtable redemptions env vars are not configured");
  }
  return { apiKey, baseId, tableName };
}

function configTableConfig() {
  const apiKey = process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_CONFIG_TABLE_NAME;
  if (!apiKey || !baseId || !tableName) {
    throw new Error("Airtable config env vars are not configured");
  }
  return { apiKey, baseId, tableName };
}

function referralsTableConfig() {
  const apiKey = process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_REFERRALS_TABLE_NAME;
  if (!apiKey || !baseId || !tableName) {
    throw new Error("Airtable referrals env vars are not configured");
  }
  return { apiKey, baseId, tableName };
}

function referralResolutionsTableConfig() {
  const apiKey = process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_REFERRAL_RESOLUTIONS_TABLE_NAME;
  if (!apiKey || !baseId || !tableName) {
    throw new Error("Airtable referral resolutions env vars are not configured");
  }
  return { apiKey, baseId, tableName };
}

function bannedUsersTableConfig() {
  const apiKey = process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_BANNED_USERS_TABLE_NAME;
  if (!apiKey || !baseId || !tableName) {
    throw new Error("Airtable banned users env vars are not configured");
  }
  // Bans change far less often than submissions/messages — a longer cache
  // window here is free staleness-wise and cuts another full-table scan off
  // every /admin and /review load.
  return { apiKey, baseId, tableName, cacheTtlMs: 60_000 };
}

type AirtableRecord<TFields = Record<string, unknown>> = {
  id: string;
  fields: TFields;
  createdTime?: string;
};

// In-process cache for GET reads, keyed by table + path (which includes the
// filterByFormula/fields[]/offset querystring). Short-lived — just enough to
// collapse the burst of near-duplicate reads one page load causes (the admin
// queue alone does several full-table scans) and to dedupe concurrent
// requests for the same page across admins, which is what was tripping
// Airtable's per-base rate limit. Any write invalidates its whole table so
// nothing goes stale after an edit. A table config can override the TTL
// (see bannedUsersTableConfig) for data that's safe to hold onto longer.
const GET_CACHE_TTL_MS = 10_000;
const getCache = new Map<string, { expires: number; promise: Promise<unknown> }>();

function invalidateTableCache(tableName: string) {
  const prefix = `${tableName}::`;
  for (const key of getCache.keys()) {
    if (key.startsWith(prefix)) getCache.delete(key);
  }
}

// Hard pace on actual outbound requests, independent of the cache above —
// this is what guarantees we never exceed Airtable's per-base rate limit
// (5 req/s), rather than just hoping the cache window happens to cover a
// burst of genuinely-distinct queries. Requests that would exceed the cap
// queue up and wait for a slot instead of firing immediately. Cache hits
// never touch this — only real network calls consume a slot.
const AIRTABLE_MAX_REQUESTS_PER_SECOND = 4;
const requestTimestamps: number[] = [];
let throttleQueue: Promise<void> = Promise.resolve();

function waitForAirtableSlot(): Promise<void> {
  const acquire = throttleQueue.then(async () => {
    for (;;) {
      const now = Date.now();
      while (requestTimestamps.length && now - requestTimestamps[0] >= 1000) {
        requestTimestamps.shift();
      }
      if (requestTimestamps.length < AIRTABLE_MAX_REQUESTS_PER_SECOND) {
        requestTimestamps.push(now);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 - (now - requestTimestamps[0]) + 5));
    }
  });
  // Chain unconditionally (ignore rejection) so one failed wait doesn't wedge
  // every request behind it.
  throttleQueue = acquire.catch(() => {});
  return acquire;
}

async function airtableRequest<T>(
  { apiKey, baseId, tableName, cacheTtlMs }: { apiKey: string; baseId: string; tableName: string; cacheTtlMs?: number },
  path: string,
  init?: RequestInit,
): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const cacheKey = `${tableName}::${path}`;

  if (method === "GET") {
    const cached = getCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.promise as Promise<T>;
    }
  }

  const requestPromise = (async () => {
    await waitForAirtableSlot();
    const response = await fetch(
      `${AIRTABLE_API_BASE}/${baseId}/${encodeURIComponent(tableName)}${path}`,
      {
        ...init,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...init?.headers,
        },
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Airtable request failed: ${response.status} ${detail}`);
    }

    return response.json();
  })();

  if (method === "GET") {
    getCache.set(cacheKey, { expires: Date.now() + (cacheTtlMs ?? GET_CACHE_TTL_MS), promise: requestPromise });
    // Don't let a failed request poison the cache for the full TTL.
    requestPromise.catch(() => getCache.delete(cacheKey));
  } else {
    invalidateTableCache(tableName);
  }

  return requestPromise as Promise<T>;
}

export async function createAirtableRecord(fields: Record<string, unknown>): Promise<AirtableRecord> {
  const config = submissionTableConfig();
  const record = await airtableRequest<AirtableRecord>(config, "", {
    method: "POST",
    body: JSON.stringify({ fields, typecast: false }),
  });
  patchQueueSnapshot(record);
  return record;
}

export async function updateAirtableRecord(
  recordId: string,
  fields: Record<string, unknown>,
): Promise<AirtableRecord> {
  const config = submissionTableConfig();
  const record = await airtableRequest<AirtableRecord>(config, `/${recordId}`, {
    method: "PATCH",
    body: JSON.stringify({ fields, typecast: false }),
  });
  patchQueueSnapshot(record);
  return record;
}

export async function deleteAirtableRecord(recordId: string): Promise<void> {
  const config = submissionTableConfig();
  await airtableRequest(config, `/${recordId}`, { method: "DELETE" });
  patchQueueSnapshot({ id: recordId, fields: {} }, true);
}

// Used by the admin purchases refund action — deletes a Redemptions record.
// Balance is computed live from sumRedeemedCost(), so this alone restores
// the redeemer's hours; no separate "refunded" bookkeeping is needed.
export async function deleteRedemptionRecord(recordId: string): Promise<void> {
  const config = redemptionsTableConfig();
  await airtableRequest(config, `/${recordId}`, { method: "DELETE" });
}

export async function listSubmissionsByEmail(
  email: string,
  fields?: string[],
): Promise<AirtableRecord[]> {

 
  const config = submissionTableConfig();
  const escaped = email.replace(/'/g, "\\'");
  const params = new URLSearchParams();
  params.set("filterByFormula", `{${SUBMISSION_FIELDS.email}} = '${escaped}'`);
  for (const field of fields ?? []) params.append("fields[]", field);
  const data = await airtableRequest<{ records: AirtableRecord[] }>(config, `?${params.toString()}`);
  // Newest first — Airtable's list API doesn't support sorting by the
  // built-in createdTime via `sort[]`, so this sorts client-side.
  return data.records
    .slice()
    .sort((a, b) => new Date(b.createdTime ?? 0).getTime() - new Date(a.createdTime ?? 0).getTime());
}

export async function getSubmissionById(recordId: string): Promise<AirtableRecord | null> {
  const config = submissionTableConfig();
  try {
    return await airtableRequest<AirtableRecord>(config, `/${recordId}`);
  } catch {
    return null;
  }
}

// Sums Optional - Override Hours Spent across one person's Approved records
// — the personal counterpart to countApprovedHours' base-wide total.
// Same "Approved field may not exist yet" degrade-to-0 fallback as
// countApprovedHours, since this now feeds getTokenBalance for /redeem too.
export async function getPersonalApprovedHours(email: string): Promise<number> {
  
 
  const config = submissionTableConfig();
  const escaped = email.replace(/'/g, "\\'");
  const params = new URLSearchParams();
  params.set(
    "filterByFormula",
    `AND({${SUBMISSION_FIELDS.email}} = '${escaped}', {${SUBMISSION_FIELDS.approved}} = TRUE())`,
  );
  params.append("fields[]", SUBMISSION_FIELDS.overrideHours);
  let data: { records: AirtableRecord[] };
  try {
    data = await airtableRequest<{ records: AirtableRecord[] }>(config, `?${params.toString()}`);
  } catch (err) {
    console.error("[getPersonalApprovedHours] failed (Approved field may not exist yet)", err);
    return 0;
  }
  return data.records.reduce((total, record) => {
    const hours = record.fields[SUBMISSION_FIELDS.overrideHours];
    return total + (typeof hours === "number" ? hours : 0);
  }, 0);
}

// Approved submissions for one person, created before a given timestamp —
// the "balance snapshot" behind an admin-facing redemption row. This is a
// reconstruction, not a stored value: hours are never earmarked to a
// specific redemption anywhere in this codebase (see getTokenBalance).
export async function listApprovedSubmissionsBeforeForEmail(
  email: string,
  beforeIso: string,
): Promise<AirtableRecord[]> {
  const config = submissionTableConfig();
  const escaped = email.replace(/'/g, "\\'");
  const parsed = Date.parse(beforeIso);
  if (Number.isNaN(parsed)) {
    throw new Error("listApprovedSubmissionsBeforeForEmail: `beforeIso` is not a valid timestamp");
  }
  const safeBefore = new Date(parsed).toISOString();
  const params = new URLSearchParams();
  params.set(
    "filterByFormula",
    `AND({${SUBMISSION_FIELDS.email}} = '${escaped}', {${SUBMISSION_FIELDS.approved}} = TRUE(), IS_BEFORE(CREATED_TIME(), '${safeBefore}'))`,
  );
  // Only what's needed to render a snapshot row — no address/birthday/email.
  for (const field of [SUBMISSION_FIELDS.hackatimeProjects, SUBMISSION_FIELDS.overrideHours]) {
    params.append("fields[]", field);
  }
  const data = await airtableRequest<{ records: AirtableRecord[] }>(config, `?${params.toString()}`);
  return data.records.sort(
    (a, b) => new Date(a.createdTime ?? 0).getTime() - new Date(b.createdTime ?? 0).getTime(),
  );
}

// Sums Cost across one person's Redemptions records — the "spent" side of
// their token balance, paired with getPersonalApprovedHours' "earned" side.
async function sumRedeemedCost(email: string): Promise<number> {
  const config = redemptionsTableConfig();
  const escaped = email.replace(/'/g, "\\'");
  let total = 0;
  let offset: string | undefined;
  do {
    const params = new URLSearchParams();
    params.set("filterByFormula", `{${REDEMPTION_FIELDS.email}} = '${escaped}'`);
    params.append("fields[]", REDEMPTION_FIELDS.cost);
    params.set("pageSize", "100");
    if (offset) params.set("offset", offset);
    const data = await airtableRequest<{ records: AirtableRecord[]; offset?: string }>(
      config,
      `?${params.toString()}`,
    );
    for (const record of data.records) {
      const cost = record.fields[REDEMPTION_FIELDS.cost];
      if (typeof cost === "number") total += cost;
    }
    offset = data.offset;
  } while (offset);
  return total;
}

// Every redemption across every user — for the admin purchases dashboard.
// Same offset-loop shape as sumRedeemedCost, but unfiltered.
export async function listAllRedemptions(): Promise<AirtableRecord[]> {
  const config = redemptionsTableConfig();
  const records: AirtableRecord[] = [];
  let offset: string | undefined;
  do {
    const params = new URLSearchParams();
    params.set("pageSize", "100");
    if (offset) params.set("offset", offset);
    const data = await airtableRequest<{ records: AirtableRecord[]; offset?: string }>(
      config,
      `?${params.toString()}`,
    );
    records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records.sort(
    (a, b) => new Date(b.createdTime ?? 0).getTime() - new Date(a.createdTime ?? 0).getTime(),
  );
}

// Full redemption history for one person — the "what did I actually buy"
// counterpart to sumRedeemedCost's running total, newest first.
export async function listRedemptionsByEmail(email: string): Promise<AirtableRecord[]> {

 
  const config = redemptionsTableConfig();
  const escaped = email.replace(/'/g, "\\'");
  const records: AirtableRecord[] = [];
  let offset: string | undefined;
  do {
    const params = new URLSearchParams();
    params.set("filterByFormula", `{${REDEMPTION_FIELDS.email}} = '${escaped}'`);
    params.set("pageSize", "100");
    if (offset) params.set("offset", offset);
    const data = await airtableRequest<{ records: AirtableRecord[]; offset?: string }>(
      config,
      `?${params.toString()}`,
    );
    records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records.sort(
    (a, b) => new Date(b.createdTime ?? 0).getTime() - new Date(a.createdTime ?? 0).getTime(),
  );
}

// Used by the admin purchases snapshot route to look up a redemption's email
// + redeemedAt server-side, so the client never has to send email back to
// the server to ask for a balance snapshot.
export async function getRedemptionById(recordId: string): Promise<AirtableRecord | null> {
  const config = redemptionsTableConfig();
  try {
    return await airtableRequest<AirtableRecord>(config, `/${recordId}`);
  } catch {
    return null;
  }
}

export async function createRedemption({
  email,
  itemName,
  cost,
}: {
  email: string;
  itemName: string;
  cost: number;
}): Promise<AirtableRecord> {
  const config = redemptionsTableConfig();
  return airtableRequest(config, "", {
    method: "POST",
    body: JSON.stringify({
      fields: {
        [REDEMPTION_FIELDS.email]: email,
        [REDEMPTION_FIELDS.itemName]: itemName,
        [REDEMPTION_FIELDS.cost]: cost,
        [REDEMPTION_FIELDS.redeemedAt]: new Date().toISOString(),
      },
      typecast: false,
    }),
  });
}

// Live token balance: earned hours from Approved submissions minus what's
// already been redeemed. Never cached — always recomputed from Airtable.
export async function getTokenBalance(email: string): Promise<number> {
  const [earned, spent] = await Promise.all([
    getPersonalApprovedHours(email),
    sumRedeemedCost(email),
  ]);
  return earned - spent;
}

// Uncached read of everything the purchase check needs. The 10s in-process
// GET cache is per server instance, so on a multi-instance deploy it can
// hide another instance's just-created redemption — that's how two
// concurrent buys both saw enough balance. Purchases must never read through
// it (cacheTtlMs: 0 => the cache entry is born expired).
//
// `redemptions` are the person's rows oldest-first (createdTime, then id) —
// a total order every concurrent request agrees on, which is what lets
// each purchase decide independently whether it was the one that overdrew.
export async function getFreshPurchaseState(email: string): Promise<{
  earned: number;
  redemptions: AirtableRecord[];
}> {
  const escaped = email.replace(/'/g, "\\'");

  const submissionConfig = { ...submissionTableConfig(), cacheTtlMs: 0 };
  const submissionParams = new URLSearchParams();
  submissionParams.set(
    "filterByFormula",
    `AND(LOWER({${SUBMISSION_FIELDS.email}}) = LOWER('${escaped}'), {${SUBMISSION_FIELDS.approved}} = TRUE())`,
  );
  submissionParams.append("fields[]", SUBMISSION_FIELDS.overrideHours);
  submissionParams.set("pageSize", "100");
  let earned = 0;
  let submissionOffset: string | undefined;
  do {
    if (submissionOffset) submissionParams.set("offset", submissionOffset);
    // No try/catch on purpose (unlike getPersonalApprovedHours): if we can't
    // verify hours, the purchase must fail rather than guess.
    const data = await airtableRequest<{ records: AirtableRecord[]; offset?: string }>(
      submissionConfig,
      `?${submissionParams.toString()}`,
    );
    for (const record of data.records) {
      const hours = record.fields[SUBMISSION_FIELDS.overrideHours];
      if (typeof hours === "number" && Number.isFinite(hours)) earned += hours;
    }
    submissionOffset = data.offset;
  } while (submissionOffset);

  const redemptionConfig = { ...redemptionsTableConfig(), cacheTtlMs: 0 };
  const redemptions: AirtableRecord[] = [];
  let redemptionOffset: string | undefined;
  do {
    const params = new URLSearchParams();
    params.set("filterByFormula", `LOWER({${REDEMPTION_FIELDS.email}}) = LOWER('${escaped}')`);
    params.set("pageSize", "100");
    if (redemptionOffset) params.set("offset", redemptionOffset);
    const data = await airtableRequest<{ records: AirtableRecord[]; offset?: string }>(
      redemptionConfig,
      `?${params.toString()}`,
    );
    redemptions.push(...data.records);
    redemptionOffset = data.offset;
  } while (redemptionOffset);
  redemptions.sort(
    (a, b) =>
      new Date(a.createdTime ?? 0).getTime() - new Date(b.createdTime ?? 0).getTime() ||
      a.id.localeCompare(b.id),
  );

  return { earned, redemptions };
}

// Pages through the full result set via Airtable's `offset` token — a
// single request silently caps at 100 records, which was truncating the
// admin queue and every stat tile computed from it once the table grew
// past that (see fix-admin-stats-pagination).
export async function listSubmissions(
  filterByFormula?: string,
  fields?: string[],
  // Overrides the default 10s GET-cache window for this scan. Writes still
  // invalidate the whole table, so a longer window only trades staleness from
  // *other* instances' edits — the queue's full scan is the slowest thing on
  // the admin/review pages, so it's worth holding onto.
  cacheTtlMs?: number,
): Promise<AirtableRecord[]> {
  const config = { ...submissionTableConfig(), cacheTtlMs };
  const records: AirtableRecord[] = [];
  let offset: string | undefined;
  do {
    const params = new URLSearchParams();
    if (filterByFormula) params.set("filterByFormula", filterByFormula);
    // Restricting `fields[]` here means PII never leaves Airtable for the
    // admin queue — this is a query-level guarantee, not just a render-level
    // one (the admin page/component never even receives the values).
    for (const field of fields ?? []) params.append("fields[]", field);
    params.set("pageSize", "100");
    if (offset) params.set("offset", offset);
    const data = await airtableRequest<{ records: AirtableRecord[]; offset?: string }>(
      config,
      `?${params.toString()}`,
    );
    records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records;
}

// In-memory copy of the queue's full-table scan, served stale-while-revalidate:
// every page load after the first returns instantly, and a snapshot older than
// SNAPSHOT_FRESH_MS is refreshed in the background rather than blocking the
// request. Writes patch the snapshot in place (see patchQueueSnapshot) so the
// page a reviewer reloads right after an action already reflects it. Only the
// very first load after a (re)start pays for the scan.
const SNAPSHOT_FRESH_MS = 30_000;
let queueSnapshot: { records: AirtableRecord[]; fetchedAt: number } | null = null;
let queueRefresh: Promise<void> | null = null;
let queueWriteCount = 0;

function refreshQueueSnapshot(): Promise<void> {
  if (queueRefresh) return queueRefresh;
  const writesAtStart = queueWriteCount;
  queueRefresh = listSubmissions(undefined, SUBMISSION_QUEUE_FIELDS, 0)
    .then((records) => {
      // A write landed mid-scan, so this result may predate it — drop it and
      // leave the (patched) snapshot marked stale for another refresh.
      if (queueWriteCount !== writesAtStart && queueSnapshot) return;
      queueSnapshot = { records, fetchedAt: Date.now() };
    })
    .finally(() => {
      queueRefresh = null;
    });
  return queueRefresh;
}

export async function getQueueSnapshot(): Promise<AirtableRecord[]> {
  if (!queueSnapshot) {
    await refreshQueueSnapshot();
  } else if (Date.now() - queueSnapshot.fetchedAt > SNAPSHOT_FRESH_MS) {
    refreshQueueSnapshot().catch((err) => console.error("[queue] background refresh failed", err));
  }
  return queueSnapshot?.records ?? [];
}

// Applies a write's result to the snapshot and marks it stale so the next read
// also re-syncs with Airtable in the background.
function patchQueueSnapshot(record: AirtableRecord, removed = false) {
  queueWriteCount += 1;
  if (!queueSnapshot) return;
  const queueFields = SUBMISSION_QUEUE_FIELDS as readonly string[];
  const others = queueSnapshot.records.filter((r) => r.id !== record.id);
  if (removed) {
    queueSnapshot = { records: others, fetchedAt: 0 };
    return;
  }
  const fields: Record<string, unknown> = {};
  for (const name of queueFields) {
    if (name in record.fields) fields[name] = record.fields[name];
  }
  const existing = queueSnapshot.records.find((r) => r.id === record.id);
  const patched = { id: record.id, fields, createdTime: record.createdTime ?? existing?.createdTime };
  // Keep the record's position; new records go on the end like Airtable's order.
  const records = existing
    ? queueSnapshot.records.map((r) => (r.id === record.id ? patched : r))
    : [...others, patched];
  queueSnapshot = { records, fetchedAt: 0 };
}

// email -> { firstName, githubUsername } for admin-dashboard display only.
// Restricted via fields[] at the query level (same guarantee documented on
// listSubmissions) so email/address/birthday never leave Airtable through
// this helper, even transiently.
export async function resolveDisplayIdentityByEmail(
  email: string,
): Promise<{ firstName: string; githubUsername: string } | null> {
  const config = submissionTableConfig();
  const escaped = email.replace(/'/g, "\\'");
  const params = new URLSearchParams();
  params.set("filterByFormula", `{${SUBMISSION_FIELDS.email}} = '${escaped}'`);
  params.set("maxRecords", "1");
  for (const field of [SUBMISSION_FIELDS.firstName, SUBMISSION_FIELDS.githubUsername]) {
    params.append("fields[]", field);
  }
  const data = await airtableRequest<{ records: AirtableRecord[] }>(config, `?${params.toString()}`);
  const record = data.records[0];
  if (!record) return null;
  return {
    firstName: String(record.fields[SUBMISSION_FIELDS.firstName] ?? ""),
    githubUsername: String(record.fields[SUBMISSION_FIELDS.githubUsername] ?? ""),
  };
}

export async function uploadAirtableAttachment({
  recordId,
  fieldName,
  file,
}: {
  recordId: string;
  fieldName: string;
  file: File;
}) {
  const { apiKey, baseId } = submissionTableConfig();

  const arrayBuffer = await file.arrayBuffer();
  const base64File = Buffer.from(arrayBuffer).toString("base64");

  const response = await fetch(
    `${AIRTABLE_CONTENT_BASE}/${baseId}/${recordId}/${encodeURIComponent(fieldName)}/uploadAttachment`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contentType: file.type || "application/octet-stream",
        filename: file.name || "screenshot",
        file: base64File,
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Airtable attachment upload failed: ${response.status} ${detail}`);
  }

  return response.json();
}

// Sums the hours-claimed field across all Approved=TRUE records, for the
// /obs-timer countdown. `Approved` doesn't exist on the live table yet
// (pending a manual Airtable step from this table's other consumer) — if the
// formula 422s because the field is missing, this degrades to 0 instead of
// throwing, so the timer route still responds.
export async function countApprovedHours(): Promise<number> {
  const config = submissionTableConfig();
  let total = 0;
  let offset: string | undefined;
  try {
    do {
      const params = new URLSearchParams();
      params.set("filterByFormula", `{${SUBMISSION_FIELDS.approved}} = TRUE()`);
      params.append("fields[]", SUBMISSION_FIELDS.overrideHours);
      params.set("pageSize", "100");
      if (offset) params.set("offset", offset);
      const data = await airtableRequest<{ records: AirtableRecord[]; offset?: string }>(
        config,
        `?${params.toString()}`,
      );
      for (const record of data.records) {
        const hours = record.fields[SUBMISSION_FIELDS.overrideHours];
        if (typeof hours === "number") total += hours;
      }
      offset = data.offset;
    } while (offset);
  } catch (err) {
    console.error("[obs-timer] countApprovedHours failed (Approved field may not exist yet)", err);
    return 0;
  }
  return total;
}

// Manual, host-controlled offset (in minutes, may be negative) folded into the
// /obs-timer deadline. Stored as the single `timerAdjustmentMinutes` row in the
// Stream Config table. A missing row / blank / non-numeric Value reads as 0.
// Throws if the config table isn't configured or the request fails — callers on
// the public timer path swallow that and treat it as 0.
export async function getTimerAdjustmentMinutes(): Promise<number> {
  const config = configTableConfig();
  const formula = encodeURIComponent(`{${CONFIG_FIELDS.key}} = '${TIMER_ADJUSTMENT_KEY}'`);
  const data = await airtableRequest<{ records: AirtableRecord[] }>(
    config,
    `?filterByFormula=${formula}&maxRecords=1`,
  );
  const value = Number(data.records[0]?.fields[CONFIG_FIELDS.value]);
  return Number.isFinite(value) ? value : 0;
}

// Upserts the `timerAdjustmentMinutes` config row.
export async function setTimerAdjustmentMinutes(value: number): Promise<void> {
  const config = configTableConfig();
  const formula = encodeURIComponent(`{${CONFIG_FIELDS.key}} = '${TIMER_ADJUSTMENT_KEY}'`);
  const data = await airtableRequest<{ records: AirtableRecord[] }>(
    config,
    `?filterByFormula=${formula}&maxRecords=1`,
  );
  const existing = data.records[0];
  if (existing) {
    await airtableRequest(config, `/${existing.id}`, {
      method: "PATCH",
      body: JSON.stringify({ fields: { [CONFIG_FIELDS.value]: value }, typecast: false }),
    });
    return;
  }
  await airtableRequest(config, "", {
    method: "POST",
    body: JSON.stringify({
      fields: { [CONFIG_FIELDS.key]: TIMER_ADJUSTMENT_KEY, [CONFIG_FIELDS.value]: value },
      typecast: false,
    }),
  });
}

// Can't filter on the linked Submission field via filterByFormula: Airtable's
// formula engine resolves a linked-record field to the linked row's primary
// field text, not its record ID, so FIND(recordId, ARRAYJOIN(...)) never
// matches. The plain REST read does return real record IDs in
// fields.Submission though, so this pages through the whole table once and
// groups client-side — one scan serves every submission on the page, instead
// of each submission re-scanning the table (which also stops silently
// truncating at Airtable's 100-record default page once Messages grows
// past that).
export async function listMessagesBySubmissionIds(
  submissionRecordIds: string[],
): Promise<Map<string, AirtableRecord[]>> {


  const config = messagesTableConfig();
  const wanted = new Set(submissionRecordIds);
  const grouped = new Map<string, AirtableRecord[]>();
  let offset: string | undefined;
  do {
    const params = new URLSearchParams();
    params.set("pageSize", "100");
    params.set("sort[0][field]", MESSAGE_FIELDS.sentAt);
    params.set("sort[0][direction]", "asc");
    if (offset) params.set("offset", offset);
    const data = await airtableRequest<{ records: AirtableRecord[]; offset?: string }>(
      config,
      `?${params.toString()}`,
    );
    for (const record of data.records) {
      const submission = record.fields[MESSAGE_FIELDS.submission];
      if (!Array.isArray(submission)) continue;
      for (const id of submission) {
        if (!wanted.has(id)) continue;
        const list = grouped.get(id);
        if (list) list.push(record);
        else grouped.set(id, [record]);
      }
    }
    offset = data.offset;
  } while (offset);
  return grouped;
}

export async function createMessage({
  submissionRecordId,
  sender,
  message,
}: {
  submissionRecordId: string;
  sender: (typeof MESSAGE_SENDER)[keyof typeof MESSAGE_SENDER];
  message: string;
}): Promise<AirtableRecord> {
  const config = messagesTableConfig();
  return airtableRequest(config, "", {
    method: "POST",
    body: JSON.stringify({
      fields: {
        [MESSAGE_FIELDS.submission]: [submissionRecordId],
        [MESSAGE_FIELDS.sender]: sender,
        [MESSAGE_FIELDS.message]: message,
        [MESSAGE_FIELDS.sentAt]: new Date().toISOString(),
      },
      typecast: false,
    }),
  });
}

// ----- Referral program -----

// Same single-quote escaping the other filterByFormula callers do inline;
// pulled out here because the referral queries use it in several places.
function escapeFormulaValue(value: string): string {
  return value.replace(/'/g, "\\'");
}

// Upserts the { Handle, Email } row for a user. Called on every /dashboard load
// so a referrer's handle can be resolved to an email later, at payout time.
export async function upsertReferralResolution(handle: string, email: string): Promise<void> {
  const config = referralResolutionsTableConfig();
  const formula = encodeURIComponent(
    `LOWER({${REFERRAL_RESOLUTION_FIELDS.handle}}) = '${escapeFormulaValue(handle.toLowerCase())}'`,
  );
  const data = await airtableRequest<{ records: AirtableRecord[] }>(
    config,
    `?filterByFormula=${formula}&maxRecords=1`,
  );
  const existing = data.records[0];
  if (existing) {
    if (String(existing.fields[REFERRAL_RESOLUTION_FIELDS.email] ?? "") === email) return;
    await airtableRequest(config, `/${existing.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        fields: { [REFERRAL_RESOLUTION_FIELDS.email]: email },
        typecast: false,
      }),
    });
    return;
  }
  await airtableRequest(config, "", {
    method: "POST",
    body: JSON.stringify({
      fields: {
        [REFERRAL_RESOLUTION_FIELDS.handle]: handle,
        [REFERRAL_RESOLUTION_FIELDS.email]: email,
      },
      typecast: false,
    }),
  });
}

// handle -> email: the Referral Resolutions row first, then any submission with
// a matching GitHub Username, then null. Both lookups degrade to null on error
// so callers on the payout path can keep the referral pending and retry.
export async function resolveReferrerEmail(handle: string): Promise<string | null> {
  const normalized = handle.trim().toLowerCase();
  if (!normalized) return null;

  try {
    const config = referralResolutionsTableConfig();
    const formula = encodeURIComponent(
      `LOWER({${REFERRAL_RESOLUTION_FIELDS.handle}}) = '${escapeFormulaValue(normalized)}'`,
    );
    const data = await airtableRequest<{ records: AirtableRecord[] }>(
      config,
      `?filterByFormula=${formula}&maxRecords=1`,
    );
    const email = data.records[0]?.fields[REFERRAL_RESOLUTION_FIELDS.email];
    if (typeof email === "string" && email) return email;
  } catch (err) {
    console.warn("[referral] resolveReferrerEmail resolution-table lookup failed", err);
  }

  try {
    const config = submissionTableConfig();
    const formula = encodeURIComponent(
      `LOWER({${SUBMISSION_FIELDS.githubUsername}}) = '${escapeFormulaValue(normalized)}'`,
    );
    const data = await airtableRequest<{ records: AirtableRecord[] }>(
      config,
      `?filterByFormula=${formula}&maxRecords=1&fields[]=${encodeURIComponent(SUBMISSION_FIELDS.email)}`,
    );
    const email = data.records[0]?.fields[SUBMISSION_FIELDS.email];
    if (typeof email === "string" && email) return email;
  } catch (err) {
    console.warn("[referral] resolveReferrerEmail submissions fallback failed", err);
  }

  return null;
}

export async function getReferralByRefereeEmail(email: string): Promise<AirtableRecord | null> {
  const config = referralsTableConfig();
  const formula = encodeURIComponent(
    `{${REFERRAL_FIELDS.refereeEmail}} = '${escapeFormulaValue(email)}'`,
  );
  const data = await airtableRequest<{ records: AirtableRecord[] }>(
    config,
    `?filterByFormula=${formula}&maxRecords=1`,
  );
  return data.records[0] ?? null;
}

export async function getReferralByRefereeEmailAndStatus(
  email: string,
  status: (typeof REFERRAL_STATUS)[keyof typeof REFERRAL_STATUS],
): Promise<AirtableRecord | null> {
  const config = referralsTableConfig();
  const formula = encodeURIComponent(
    `AND({${REFERRAL_FIELDS.refereeEmail}} = '${escapeFormulaValue(email)}', {${REFERRAL_FIELDS.status}} = '${status}')`,
  );
  const data = await airtableRequest<{ records: AirtableRecord[] }>(
    config,
    `?filterByFormula=${formula}&maxRecords=1`,
  );
  return data.records[0] ?? null;
}

// Count of paid referrals credited to a handle — the referrer's "people I
// referred who shipped" number, which is also their earned-balloon count.
export async function countPaidReferralsForHandle(handle: string): Promise<number> {
  const normalized = handle.trim().toLowerCase();
  if (!normalized) return 0;
  const config = referralsTableConfig();
  let count = 0;
  let offset: string | undefined;
  do {
    const params = new URLSearchParams();
    params.set(
      "filterByFormula",
      `AND(LOWER({${REFERRAL_FIELDS.referrerHandle}}) = '${escapeFormulaValue(normalized)}', {${REFERRAL_FIELDS.status}} = '${REFERRAL_STATUS.paid}')`,
    );
    params.append("fields[]", REFERRAL_FIELDS.status);
    params.set("pageSize", "100");
    if (offset) params.set("offset", offset);
    const data = await airtableRequest<{ records: AirtableRecord[]; offset?: string }>(
      config,
      `?${params.toString()}`,
    );
    count += data.records.length;
    offset = data.offset;
  } while (offset);
  return count;
}

export async function createReferral({
  refereeEmail,
  referrerHandle,
  source,
}: {
  refereeEmail: string;
  referrerHandle: string;
  source: (typeof REFERRAL_SOURCE)[keyof typeof REFERRAL_SOURCE];
}): Promise<AirtableRecord> {
  const config = referralsTableConfig();
  return airtableRequest(config, "", {
    method: "POST",
    body: JSON.stringify({
      fields: {
        [REFERRAL_FIELDS.refereeEmail]: refereeEmail,
        [REFERRAL_FIELDS.referrerHandle]: referrerHandle,
        [REFERRAL_FIELDS.source]: source,
        [REFERRAL_FIELDS.status]: REFERRAL_STATUS.pending,
        [REFERRAL_FIELDS.boundAt]: new Date().toISOString(),
      },
      typecast: false,
    }),
  });
}

// Every referral relationship — for the admin referrals dashboard. Same
// offset-loop shape as listAllRedemptions, unfiltered.
export async function listAllReferrals(): Promise<AirtableRecord[]> {
  const config = referralsTableConfig();
  const records: AirtableRecord[] = [];
  let offset: string | undefined;
  do {
    const params = new URLSearchParams();
    params.set("pageSize", "100");
    if (offset) params.set("offset", offset);
    const data = await airtableRequest<{ records: AirtableRecord[]; offset?: string }>(
      config,
      `?${params.toString()}`,
    );
    records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records.sort(
    (a, b) => new Date(b.createdTime ?? 0).getTime() - new Date(a.createdTime ?? 0).getTime(),
  );
}

export async function markReferralPaid({
  referralId,
  referrerEmail,
  submissionRecordId,
  redemptionRecordId,
}: {
  referralId: string;
  referrerEmail: string;
  submissionRecordId: string;
  redemptionRecordId: string;
}): Promise<void> {
  const config = referralsTableConfig();
  const fields: Record<string, unknown> = {
    [REFERRAL_FIELDS.status]: REFERRAL_STATUS.paid,
    [REFERRAL_FIELDS.paidAt]: new Date().toISOString(),
    [REFERRAL_FIELDS.referrerEmail]: referrerEmail,
  };
  if (submissionRecordId) fields[REFERRAL_FIELDS.refereeSubmission] = [submissionRecordId];
  if (redemptionRecordId) fields[REFERRAL_FIELDS.redemption] = [redemptionRecordId];
  await airtableRequest(config, `/${referralId}`, {
    method: "PATCH",
    body: JSON.stringify({ fields, typecast: false }),
  });
}

// ----- Banned Users -----

export async function getBannedUserByEmail(email: string): Promise<AirtableRecord | null> {
  const config = bannedUsersTableConfig();
  const formula = encodeURIComponent(
    `LOWER({${BANNED_USER_FIELDS.email}}) = '${escapeFormulaValue(email.toLowerCase())}'`,
  );
  const data = await airtableRequest<{ records: AirtableRecord[] }>(
    config,
    `?filterByFormula=${formula}&maxRecords=1`,
  );
  return data.records[0] ?? null;
}

// Every ban — for the admin banned-users page and for the review queue's
// cross-referencing badge (see app/admin/page.tsx, app/review/page.tsx).
export async function listBannedUsers(): Promise<AirtableRecord[]> {
  const config = bannedUsersTableConfig();
  const records: AirtableRecord[] = [];
  let offset: string | undefined;
  do {
    const params = new URLSearchParams();
    params.set("pageSize", "100");
    if (offset) params.set("offset", offset);
    const data = await airtableRequest<{ records: AirtableRecord[]; offset?: string }>(
      config,
      `?${params.toString()}`,
    );
    records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records.sort(
    (a, b) => new Date(b.createdTime ?? 0).getTime() - new Date(a.createdTime ?? 0).getTime(),
  );
}

export async function createBannedUser({
  email,
  bannedBy,
  reason,
}: {
  email: string;
  bannedBy: string;
  reason?: string;
}): Promise<AirtableRecord> {
  const config = bannedUsersTableConfig();
  return airtableRequest(config, "", {
    method: "POST",
    body: JSON.stringify({
      fields: {
        [BANNED_USER_FIELDS.email]: email,
        [BANNED_USER_FIELDS.bannedAt]: new Date().toISOString(),
        [BANNED_USER_FIELDS.bannedBy]: bannedBy,
        [BANNED_USER_FIELDS.reason]: reason || undefined,
      },
      typecast: false,
    }),
  });
}

export async function deleteBannedUser(recordId: string): Promise<void> {
  const config = bannedUsersTableConfig();
  await airtableRequest(config, `/${recordId}`, { method: "DELETE" });
}
