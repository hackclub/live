import {
  deleteRedemptionRecord,
  listAllRedemptions,
  listSubmissions,
  REDEMPTION_FIELDS,
  SUBMISSION_FIELDS,
} from "./airtable";

// Shared by the admin "refund everything" UI (app/api/admin/purchases/refund-all)
// and scripts/refund-all-purchases.ts.
//
// Balance = sum(Approved "Override Hours Spent") - sum(Redemptions Cost), all
// computed live (see getTokenBalance), so deleting a Cost > 0 Redemptions row
// is the refund. Cost === 0 rows (referral rewards) are never touched.

// Anyone above this many approved hours gets flagged for a manual look.
export const HIGH_HOURS_FLAG = 100;

export type RefundPlanRow = {
  email: string;
  earned: number;
  spent: number;
  balanceBefore: number;
  balanceAfter: number;
  flag: "overspent" | "high_hours" | null;
};

export type RefundPlan = {
  rows: RefundPlanRow[];
  refundableCount: number;
  keptCount: number;
  totalRefunded: number;
  totalEarned: number;
  badHours: string[];
  duplicateCodeUrls: { url: string; emails: string[] }[];
  // Every Redemptions row as it exists now, for the admin to download first.
  backup: unknown[];
};

const norm = (email: unknown) => String(email ?? "").trim().toLowerCase();
const cost = (r: { fields: Record<string, unknown> }) => Number(r.fields[REDEMPTION_FIELDS.cost] ?? 0);

export async function buildRefundPlan(): Promise<RefundPlan> {
  const redemptions = await listAllRedemptions();
  const refundable = redemptions.filter((r) => cost(r) > 0);

  const approved = await listSubmissions(`{${SUBMISSION_FIELDS.approved}} = TRUE()`, [
    SUBMISSION_FIELDS.email,
    SUBMISSION_FIELDS.overrideHours,
    SUBMISSION_FIELDS.codeUrl,
  ]);

  const earned = new Map<string, number>();
  const codeUrls = new Map<string, string[]>();
  const badHours: string[] = [];
  for (const rec of approved) {
    const email = norm(rec.fields[SUBMISSION_FIELDS.email]);
    const hours = rec.fields[SUBMISSION_FIELDS.overrideHours];
    if (typeof hours !== "number" || !Number.isFinite(hours) || hours < 0) {
      badHours.push(`${rec.id} (${email}): hours=${JSON.stringify(hours)}`);
      continue;
    }
    earned.set(email, (earned.get(email) ?? 0) + hours);
    const url = String(rec.fields[SUBMISSION_FIELDS.codeUrl] ?? "").trim().toLowerCase();
    if (url) codeUrls.set(url, [...(codeUrls.get(url) ?? []), email]);
  }

  const spent = new Map<string, number>();
  for (const r of refundable) {
    const email = norm(r.fields[REDEMPTION_FIELDS.email]);
    spent.set(email, (spent.get(email) ?? 0) + cost(r));
  }

  const rows: RefundPlanRow[] = [...new Set([...earned.keys(), ...spent.keys()])]
    .sort()
    .map((email) => {
      const e = earned.get(email) ?? 0;
      const s = spent.get(email) ?? 0;
      return {
        email,
        earned: e,
        spent: s,
        balanceBefore: e - s,
        balanceAfter: e,
        flag: s > e ? "overspent" : e > HIGH_HOURS_FLAG ? "high_hours" : null,
      };
    });

  return {
    rows,
    refundableCount: refundable.length,
    keptCount: redemptions.length - refundable.length,
    totalRefunded: rows.reduce((sum, r) => sum + r.spent, 0),
    totalEarned: rows.reduce((sum, r) => sum + r.earned, 0),
    badHours,
    duplicateCodeUrls: [...codeUrls]
      .filter(([, emails]) => emails.length > 1)
      .map(([url, emails]) => ({ url, emails })),
    backup: redemptions,
  };
}

// Deletes up to `limit` refundable rows (re-read fresh each call, so a row
// created mid-run is picked up too) and reports how many are left. Callers
// loop until `remaining` is 0; keeping each call small keeps it inside
// serverless time limits given Airtable's 5 req/s cap.
export async function refundBatch(limit: number): Promise<{ deleted: number; failed: number; remaining: number }> {
  const refundable = (await listAllRedemptions()).filter((r) => cost(r) > 0);
  const batch = refundable.slice(0, limit);
  let deleted = 0;
  let failed = 0;
  for (const r of batch) {
    try {
      await deleteRedemptionRecord(r.id);
      deleted++;
    } catch (err) {
      failed++;
      console.error("[refund-all] failed to delete", r.id, err);
    }
  }
  return { deleted, failed, remaining: refundable.length - deleted };
}
