import { NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../src/lib/auth";
import { createRedemption, getTokenBalance } from "../../../../src/lib/airtable";
import { getIdentity } from "../../../../src/lib/hackclub";
import { findShopItemByName } from "../../../../src/lib/shopItems";

const pendingRedemptions = new Set<string>();

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session?.access_token) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  const identity = await getIdentity(session.access_token);
  if (!identity?.primary_email) {
    return NextResponse.json({ error: "identity_unavailable" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const itemName = String(body.itemName ?? "");
  const quantity = body.quantity === undefined ? 1 : body.quantity;
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    return NextResponse.json({ error: "invalid_quantity" }, { status: 400 });
  }

  // Price is always looked up server-side from the catalog — a client-
  // supplied price is never trusted.
  const item = findShopItemByName(itemName);
  if (!item) {
    return NextResponse.json({ error: "item_not_found" }, { status: 400 });
  }

  const cost = item.price * quantity;
  if (!Number.isFinite(cost) || cost <= 0) {
    return NextResponse.json({ error: "invalid_quantity" }, { status: 400 });
  }

  const email = identity.primary_email;
  if (pendingRedemptions.has(email)) {
    return NextResponse.json({ error: "redemption_pending" }, { status: 409 });
  }

  pendingRedemptions.add(email);
  try {
    const balance = await getTokenBalance(email);
    if (!Number.isFinite(balance) || balance < cost) {
      return NextResponse.json({ error: "insufficient_balance", balance }, { status: 400 });
    }

    await createRedemption({ email, itemName: item.name, cost, quantity });
    return NextResponse.json({ ok: true, balance: balance - cost, quantity });
  } catch (error) {
    console.error("[redeem] purchase failed", error);
    return NextResponse.json({ error: "redemption_failed" }, { status: 500 });
  } finally {
    pendingRedemptions.delete(email);
  }
}
