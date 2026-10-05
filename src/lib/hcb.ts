// Public HCB API (Hack Club's bank) for the Live YSWS v2 org. No auth needed
// because the org is transparent. Returns null on any failure so the admin
// page still renders.
const HCB_ORG_SLUG = "live-ysws-v2";

// What one approved hour is worth when it's redeemed.
export const HOUR_VALUE_USD = 8.5;

export async function getHcbBalanceCents(): Promise<number | null> {
  try {
    const res = await fetch(`https://hcb.hackclub.com/api/v3/organizations/${HCB_ORG_SLUG}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { balances?: { balance_cents?: number }; balance_cents?: number };
    const cents = data.balances?.balance_cents ?? data.balance_cents;
    return typeof cents === "number" ? cents : null;
  } catch (err) {
    console.error("[hcb] failed to read balance", err);
    return null;
  }
}
