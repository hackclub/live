// Pure grouping / classification / finance math for the admin fulfillment
// dashboard. No I/O and no server-only imports, so the server page and the
// client dashboard run the exact same functions — the client re-runs them
// after a fulfill or refund instead of reloading.
import { HOUR_VALUE_USD as REVENUE_USD_PER_HOUR, PAYOUT_USD_PER_HOUR } from "./hcb";

export { PAYOUT_USD_PER_HOUR, REVENUE_USD_PER_HOUR };

// Float sums of hours like 7.4 drift by ~1e-15; anything above this counts
// as real overspend, so 0.1h still flags.
const EPSILON = 1e-9;

export type SpendStatus = "EXPLOIT" | "OVERAGE" | "OK" | "UNKNOWN";

export type RedemptionInput = {
  id: string;
  email: string; // normalized
  itemName: string;
  cost: number;
  redeemedAt: string;
  fulfilledAt: string | null;
  referralId: string | null;
};

export type ProjectView = {
  id: string;
  project: string;
  hours: number;
  codeUrl: string;
  playableUrl: string;
  inUnified: boolean;
  unifiedUrl: string | null;
  justification: string | null; // the hours justification as written in Unified
};

export type UserInput = {
  email: string; // normalized
  firstName: string;
  githubUsername: string;
  localHours: number;
  unifiedHours: number | null; // null = Unified unavailable
  projects: ProjectView[];
};

export type ItemLine = {
  key: string;
  itemName: string;
  cost: number;
  fulfilled: boolean;
  recordIds: string[]; // newest first
  count: number;
  hours: number;
  usd: number;
  referralId: string | null;
  refundable: boolean;
};

export type UserView = UserInput & {
  spent: number;
  unfulfilledHours: number;
  status: SpendStatus;
  exploitHours: number;
  overageHours: number;
  exploitUnfulfilledHours: number;
  overageUnfulfilledHours: number;
  unfulfilled: ItemLine[];
  fulfilled: ItemLine[];
};

export type Finances = {
  hcbUsd: number | null;
  hcbFetchedAt: string | null;
  unfulfilledHours: number;
  unfulfilledUsd: number;
  headlineUsd: number | null; // HCB − unfulfilled, self-funding overage
  revenueEarnedUsd: number | null;
  pendingRevenueUsd: number | null;
  overageHours: number;
  overageUnfulfilledHours: number;
  exploitHours: number;
  exploitUnfulfilledHours: number;
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeCodeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function classifyUser(spent: number, localHours: number, unifiedHours: number | null): SpendStatus {
  if (spent > localHours + EPSILON) return "EXPLOIT";
  if (unifiedHours === null) return "UNKNOWN";
  if (spent > unifiedHours + EPSILON) return "OVERAGE";
  return "OK";
}

// Collapses one user's redemptions into ×N lines. Referral payouts stay one
// line each so their referral link stays attached to the right row.
export function groupLines(redemptions: RedemptionInput[]): ItemLine[] {
  const sorted = redemptions.slice().sort((a, b) => Date.parse(b.redeemedAt || "0") - Date.parse(a.redeemedAt || "0"));
  const lines = new Map<string, ItemLine>();
  for (const r of sorted) {
    const fulfilled = r.fulfilledAt !== null;
    const key = r.referralId ? `ref::${r.id}` : `${r.itemName}::${r.cost}::${fulfilled}`;
    let line = lines.get(key);
    if (!line) {
      line = {
        key,
        itemName: r.itemName,
        cost: r.cost,
        fulfilled,
        recordIds: [],
        count: 0,
        hours: 0,
        usd: 0,
        referralId: r.referralId,
        refundable: r.cost > 0 && !r.referralId,
      };
      lines.set(key, line);
    }
    line.recordIds.push(r.id);
    line.count += 1;
    line.hours += r.cost;
    line.usd = line.hours * PAYOUT_USD_PER_HOUR;
  }
  return Array.from(lines.values());
}

const STATUS_ORDER: Record<SpendStatus, number> = { EXPLOIT: 0, OVERAGE: 1, UNKNOWN: 2, OK: 3 };

export function buildUserViews(users: UserInput[], redemptions: RedemptionInput[]): UserView[] {
  const byEmail = new Map<string, RedemptionInput[]>();
  for (const r of redemptions) {
    const list = byEmail.get(r.email) ?? [];
    list.push(r);
    byEmail.set(r.email, list);
  }

  const views: UserView[] = [];
  for (const user of users) {
    const own = byEmail.get(user.email) ?? [];
    if (own.length === 0) continue;
    const lines = groupLines(own);
    const spent = own.reduce((sum, r) => sum + r.cost, 0);
    const unfulfilledHours = own.reduce((sum, r) => sum + (r.fulfilledAt === null ? r.cost : 0), 0);
    const exploitHours = Math.max(0, spent - user.localHours);
    const overageHours =
      user.unifiedHours === null ? 0 : Math.max(0, Math.min(spent, user.localHours) - user.unifiedHours);
    // Estimate: assume the newest unfulfilled purchases are the ones over the
    // line — purchases are never tied to specific projects.
    const exploitUnfulfilledHours = Math.min(unfulfilledHours, exploitHours);
    const overageUnfulfilledHours = Math.min(unfulfilledHours - exploitUnfulfilledHours, overageHours);
    views.push({
      ...user,
      spent,
      unfulfilledHours,
      status: classifyUser(spent, user.localHours, user.unifiedHours),
      exploitHours: exploitHours > EPSILON ? exploitHours : 0,
      overageHours: overageHours > EPSILON ? overageHours : 0,
      exploitUnfulfilledHours: exploitUnfulfilledHours > EPSILON ? exploitUnfulfilledHours : 0,
      overageUnfulfilledHours: overageUnfulfilledHours > EPSILON ? overageUnfulfilledHours : 0,
      unfulfilled: lines.filter((l) => !l.fulfilled),
      fulfilled: lines.filter((l) => l.fulfilled),
    });
  }

  return views.sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.unfulfilledHours - a.unfulfilledHours,
  );
}

export function computeFinances(
  views: UserView[],
  {
    hcbCents,
    hcbFetchedAt,
    unifiedTotalHours,
    pendingHours,
  }: {
    hcbCents: number | null;
    hcbFetchedAt: string | null;
    unifiedTotalHours: number | null;
    pendingHours: number | null;
  },
): Finances {
  const unfulfilledHours = views.reduce((sum, v) => sum + v.unfulfilledHours, 0);
  const unfulfilledUsd = unfulfilledHours * PAYOUT_USD_PER_HOUR;
  const hcbUsd = hcbCents === null ? null : hcbCents / 100;
  return {
    hcbUsd,
    hcbFetchedAt,
    unfulfilledHours,
    unfulfilledUsd,
    headlineUsd: hcbUsd === null ? null : hcbUsd - unfulfilledUsd,
    revenueEarnedUsd: unifiedTotalHours === null ? null : unifiedTotalHours * REVENUE_USD_PER_HOUR,
    pendingRevenueUsd: pendingHours === null ? null : pendingHours * REVENUE_USD_PER_HOUR,
    overageHours: views.reduce((sum, v) => sum + v.overageHours, 0),
    overageUnfulfilledHours: views.reduce((sum, v) => sum + v.overageUnfulfilledHours, 0),
    exploitHours: views.reduce((sum, v) => sum + v.exploitHours, 0),
    exploitUnfulfilledHours: views.reduce((sum, v) => sum + v.exploitUnfulfilledHours, 0),
  };
}
