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
  hackatimeId: "Justification - Submitter Hackatime ID",
  hackatimeProjects: "Justification - Hackatime Project Name(s) + Date Range(s)",
  lapseLinks: "Justification - Lapse Links, comma-separated",
  // Added by this change — must exist in Airtable before use (see tasks.md 1.1).
  approved: "Approved",
  reviewStatus: "Review Status",
  reviewedAt: "Reviewed At",
  reviewedBy: "Reviewed By",
} as const;

export const REVIEW_STATUS = {
  pending: "Pending",
  rejected: "Rejected",
  fraud: "Fraud",
} as const;

// Added by this change — must exist in Airtable before use (see tasks.md 1.2).
export const MESSAGE_FIELDS = {
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
export const CONFIG_FIELDS = {
  key: "Key",
  value: "Value",
} as const;

// The single config row that holds the manual /obs-timer offset in minutes.
export const TIMER_ADJUSTMENT_KEY = "timerAdjustmentMinutes";

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

export const REFERRAL_RESOLUTION_FIELDS = {
  handle: "Handle",
  email: "Email",
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
  return { apiKey, baseId, tableName };
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

export type AirtableRecord<TFields = Record<string, unknown>> = {
  id: string;
  fields: TFields;
  createdTime?: string;
};

async function airtableRequest<T>(
  { apiKey, baseId, tableName }: { apiKey: string; baseId: string; tableName: string },
  path: string,
  init?: RequestInit,
): Promise<T> {
  
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
}

export async function createAirtableRecord(fields: Record<string, unknown>): Promise<AirtableRecord> {
  const config = submissionTableConfig();
  return airtableRequest(config, "", {
    method: "POST",
    body: JSON.stringify({ fields, typecast: false }),
  });
}

export async function updateAirtableRecord(
  recordId: string,
  fields: Record<string, unknown>,
): Promise<AirtableRecord> {
  const config = submissionTableConfig();
  return airtableRequest(config, `/${recordId}`, {
    method: "PATCH",
    body: JSON.stringify({ fields, typecast: false }),
  });
}

export async function deleteAirtableRecord(recordId: string): Promise<void> {
  const config = submissionTableConfig();
  await airtableRequest(config, `/${recordId}`, { method: "DELETE" });
}

// NOTE: kept for callers that only need "does this person have any record"
// (e.g. /api/messages ownership checks). Submission create/update no longer
// uses this to decide create-vs-update — a person can have multiple
// records now, so that decision is made by an explicit recordId instead.
export async function findSubmissionByEmail(email: string): Promise<AirtableRecord | null> {
  const config = submissionTableConfig();
  const escaped = email.replace(/'/g, "\\'");
  const formula = encodeURIComponent(`{${SUBMISSION_FIELDS.email}} = '${escaped}'`);
  const data = await airtableRequest<{ records: AirtableRecord[] }>(
    config,
    `?filterByFormula=${formula}&maxRecords=1`,
  );
  return data.records[0] ?? null;
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
  // built-in createdTime via `sort[]`, so this sorts client-side (same
  // approach as listSubmissionsCreatedAfter below).
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

// Sums Cost across one person's Redemptions records — the "spent" side of
// their token balance, paired with getPersonalApprovedHours' "earned" side.
export async function sumRedeemedCost(email: string): Promise<number> {
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

export async function listSubmissions(
  filterByFormula?: string,
  fields?: string[],
): Promise<AirtableRecord[]> {
  const config = submissionTableConfig();
  const params = new URLSearchParams();
  if (filterByFormula) params.set("filterByFormula", filterByFormula);
  // Restricting `fields[]` here means PII never leaves Airtable for the
  // admin queue — this is a query-level guarantee, not just a render-level
  // one (the admin page/component never even receives the values).
  for (const field of fields ?? []) params.append("fields[]", field);
  const query = params.toString() ? `?${params.toString()}` : "";
  const data = await airtableRequest<{ records: AirtableRecord[] }>(config, query);
  return data.records;
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

// For /obs-submissions: records created after `sinceIso` (or, with no
// `sinceIso`, the most recent `maxRecords`), keyed off Airtable's built-in
// `createdTime` rather than any field — immune to resubmit-in-place edits
// bumping a "last updated" value and re-triggering an announcement.
export async function listSubmissionsCreatedAfter(
  sinceIso: string | null,
  opts: { maxRecords?: number } = {},
): Promise<AirtableRecord[]> {
  const config = submissionTableConfig();
  const fields = [SUBMISSION_FIELDS.githubUsername, SUBMISSION_FIELDS.overrideHours];

  // `sinceIso` ends up interpolated into a filterByFormula string, so it is
  // never trusted verbatim: re-parse it to a canonical ISO timestamp and
  // reject anything else. This keeps arbitrary formula text out of the
  // query even if a caller forgets to validate.
  let safeSince: string | null = null;
  if (sinceIso !== null && sinceIso !== "") {
    const parsed = Date.parse(sinceIso);
    if (Number.isNaN(parsed)) {
      throw new Error("listSubmissionsCreatedAfter: `sinceIso` is not a valid timestamp");
    }
    safeSince = new Date(parsed).toISOString();
  }

  let records: AirtableRecord[] = [];
  let offset: string | undefined;
  do {
    const params = new URLSearchParams();
    if (safeSince) params.set("filterByFormula", `IS_AFTER(CREATED_TIME(), '${safeSince}')`);
    for (const field of fields) params.append("fields[]", field);
    params.set("pageSize", "100");
    if (offset) params.set("offset", offset);
    const data = await airtableRequest<{ records: AirtableRecord[]; offset?: string }>(
      config,
      `?${params.toString()}`,
    );
    records = records.concat(data.records);
    offset = data.offset;
  } while (offset);

  records.sort(
    (a, b) => new Date(a.createdTime ?? 0).getTime() - new Date(b.createdTime ?? 0).getTime(),
  );

  if (!safeSince && opts.maxRecords) {
    return records.slice(-opts.maxRecords);
  }
  return records;
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

export async function listMessages(submissionRecordId: string): Promise<AirtableRecord[]> {
  const grouped = await listMessagesBySubmissionIds([submissionRecordId]);
  return grouped.get(submissionRecordId) ?? [];
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
