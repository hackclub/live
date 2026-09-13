import { NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../src/lib/auth";
import {
  createRedemption,
  deleteRedemptionRecord,
  getTokenBalance,
} from "../../../../src/lib/airtable";
import { isEmailBanned } from "../../../../src/lib/bans";
import { getIdentity } from "../../../../src/lib/hackclub";
import { withLock } from "../../../../src/lib/lock";
import { findShopItemByName } from "../../../../src/lib/shopItems";

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

  const outcome = await withLock(`redeem:${identity.primary_email.toLowerCase()}`, async () => {
    const balance = await getTokenBalance(identity.primary_email!);
    if (balance < item.price) {
      return { error: "insufficient_balance" as const, balance };
    }

    const redemption = await createRedemption({
      email: identity.primary_email!,
      itemName: item.name,
      cost: item.price,
    });

    const newBalance = await getTokenBalance(identity.primary_email!);
    if (newBalance < 0) {
      await deleteRedemptionRecord(redemption.id).catch(() => {});
      return { error: "insufficient_balance" as const, balance: newBalance + item.price };
    }

    return { ok: true as const, balance: newBalance };
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error, balance: outcome.balance }, { status: 400 });
  }

  return NextResponse.json({ ok: true, balance: outcome.balance });
}
