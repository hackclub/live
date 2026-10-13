// Public HCB API (Hack Club's bank) for the Live YSWS v2 org. No auth needed
// because the org is transparent. Returns null on any failure so the admin
// page still renders.
const HCB_ORG_SLUG = "live-ysws-v2";

// Revenue: what Unified pays us per approved Live hour that lands there.
export const HOUR_VALUE_USD = 8.5;

// Payout: what one redeemed hour actually costs us on average when we
// fulfill it. Lower than HOUR_VALUE_USD — that gap is our margin.
export const PAYOUT_USD_PER_HOUR = 5;

// `fetchedAt` is when HCB produced the response (its Date header), not when
// we read it — the fetch is cached for up to 5 minutes, so the two differ.
export async function getHcbBalance(): Promise<{ cents: number; fetchedAt: string } | null> {
  try {
    const res = await fetch(`https://hcb.hackclub.com/api/v3/organizations/${HCB_ORG_SLUG}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { balances?: { balance_cents?: number }; balance_cents?: number };
    const cents = data.balances?.balance_cents ?? data.balance_cents;
    if (typeof cents !== "number") return null;
    const date = Date.parse(res.headers.get("date") ?? "");
    return { cents, fetchedAt: new Date(Number.isNaN(date) ? Date.now() : date).toISOString() };
  } catch (err) {
    console.error("[hcb] failed to read balance", err);
    return null;
  }
}
