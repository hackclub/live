import { NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../src/lib/auth";
import {
  createRedemption,
  deleteRedemptionRecord,
  getFreshPurchaseState,
  REDEMPTION_FIELDS,
} from "../../../../src/lib/airtable";
import { isEmailBanned } from "../../../../src/lib/bans";
import { getIdentity } from "../../../../src/lib/hackclub";
import { withLock } from "../../../../src/lib/lock";
import { findShopItemByName } from "../../../../src/lib/shopItems";

// Same item bought again inside this window is treated as a double-submit
// (double-click, retry, two tabs), not a deliberate second purchase.
const DUPLICATE_WINDOW_MS = 15_000;

type Redemption = { fields: Record<string, unknown>; createdTime?: string };

function spentOf(redemptions: Redemption[]): number {
  return redemptions.reduce((sum, r) => {
    const cost = r.fields[REDEMPTION_FIELDS.cost];
    return sum + (typeof cost === "number" ? cost : 0);
  }, 0);
}

// `earlier` = redemptions that came before the purchase being judged, which
// happened at `atMs`.
function isRecentDuplicate(earlier: Redemption[], itemName: string, atMs: number): boolean {
  return earlier.some((r) => {
    if (r.fields[REDEMPTION_FIELDS.itemName] !== itemName) return false;
    if (Number(r.fields[REDEMPTION_FIELDS.cost] ?? 0) <= 0) return false;
    const at = new Date(r.createdTime ?? 0).getTime();
    return atMs - at < DUPLICATE_WINDOW_MS;
  });
}

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session?.access_token) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  const identity = await getIdentity(session.access_token);
  if (!identity?.primary_email) {
    return NextResponse.json({ error: "identity_unavailable" }, { status: 401 });
  }

  if (await isEmailBanned(identity.primary_email)) {
    return NextResponse.json({ error: "banned" }, { status: 403 });
  }

  const body = await request.json();
  const itemName = String(body.itemName ?? "");

  // Price is always looked up server-side from the catalog — a client-
  // supplied price is never trusted.
  const item = findShopItemByName(itemName);
  if (!item) {
    return NextResponse.json({ error: "item_not_found" }, { status: 400 });
  }

  const email = identity.primary_email;

  // withLock only serializes requests landing on the *same* server instance;
  // with several instances (or a double-click racing across them) two buys can
  // interleave. So the lock is just a first line of defense — correctness
  // comes from verifying after the write, below.
  const outcome = await withLock(`redeem:${email.toLowerCase()}`, async () => {
    // Fresh (uncached) reads only — a stale cached balance is what let
    // concurrent purchases both pass the check.
    const before = await getFreshPurchaseState(email);
    const balanceBefore = before.earned - spentOf(before.redemptions);
    if (balanceBefore < item.price) {
      return { error: "insufficient_balance" as const, balance: balanceBefore };
    }
    if (isRecentDuplicate(before.redemptions, item.name, Date.now())) {
      return { error: "duplicate_request" as const, balance: balanceBefore };
    }

    const redemption = await createRedemption({ email, itemName: item.name, cost: item.price });

    // Arbitrate: replay this person's redemptions in the one global order
    // (createdTime, id). Every concurrent request sees the same order, so
    // whichever purchase is the first to overdraw — or repeats an item within
    // the duplicate window — is the loser, and only the loser deletes itself.
    // A request that created earlier is never undone by one created later.
    const after = await getFreshPurchaseState(email);
    const myIndex = after.redemptions.findIndex((r) => r.id === redemption.id);
    const upToMine = myIndex === -1 ? after.redemptions : after.redemptions.slice(0, myIndex + 1);
    const overdrawn = spentOf(upToMine) > after.earned;
    const myCreatedAt = new Date(after.redemptions[myIndex]?.createdTime ?? 0).getTime();
    const duplicate = myIndex > 0 && isRecentDuplicate(after.redemptions.slice(0, myIndex), item.name, myCreatedAt);
    const mineMissing = myIndex === -1;

    if (overdrawn || duplicate || mineMissing) {
      try {
        await deleteRedemptionRecord(redemption.id);
      } catch (err) {
        console.error("[redeem] failed to roll back redemption", redemption.id, err);
        return { error: "rollback_failed" as const, balance: after.earned - spentOf(after.redemptions) };
      }
      const balance = after.earned - spentOf(after.redemptions.filter((r) => r.id !== redemption.id));
      return { error: overdrawn ? ("insufficient_balance" as const) : ("duplicate_request" as const), balance };
    }

    return { ok: true as const, balance: after.earned - spentOf(after.redemptions) };
  });

  if ("error" in outcome) {
    const status = outcome.error === "rollback_failed" ? 500 : 400;
    return NextResponse.json({ error: outcome.error, balance: outcome.balance }, { status });
  }

  return NextResponse.json({ ok: true, balance: outcome.balance });
}
