import { NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../../src/lib/auth";
import { isAdminEmail } from "../../../../../src/lib/admin";
import { getIdentity } from "../../../../../src/lib/hackclub";
import {
  deleteRedemptionRecord,
  getRedemptionById,
  REDEMPTION_FIELDS,
} from "../../../../../src/lib/airtable";

export const dynamic = "force-dynamic";

// Same identity check as app/api/admin/timer/route.ts and
// app/api/admin/purchases/snapshot/route.ts. Admin-only — unlike the review
// queue, /admin/purchases (the page) never grants reviewers access, so this
// mirrors that rather than allowing isReviewerEmail.
async function requireAdmin(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session?.access_token) {
    return { ok: false as const, response: NextResponse.json({ error: "not_authenticated" }, { status: 401 }) };
  }
  const identity = await getIdentity(session.access_token);
  if (!identity?.primary_email || !isAdminEmail(identity.primary_email)) {
    return { ok: false as const, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { ok: true as const, email: identity.primary_email };
}

// Refunds a direct purchase by deleting its Redemptions record. Token
// balance is computed live from sumRedeemedCost(), so deleting the record
// is itself the refund — no separate "restore hours" step.
//
// Referral-payout rows (Cost === 0) are never refundable, and an admin can
// never refund their own redemption — both re-checked here server-side
// since recordId is client-supplied.
export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const recordId = String((body as { recordId?: unknown })?.recordId ?? "");
  if (!recordId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const redemption = await getRedemptionById(recordId);
  if (!redemption) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const cost = Number(redemption.fields[REDEMPTION_FIELDS.cost] ?? 0);
  if (cost <= 0) {
    return NextResponse.json({ error: "not_refundable" }, { status: 400 });
  }

  const redemptionEmail = String(redemption.fields[REDEMPTION_FIELDS.email] ?? "").trim();
  if (redemptionEmail && redemptionEmail.toLowerCase() === gate.email.toLowerCase()) {
    return NextResponse.json({ error: "cannot_refund_own_purchase" }, { status: 403 });
  }

  await deleteRedemptionRecord(recordId);
  console.log(`[admin-purchases] ${gate.email} refunded redemption ${recordId}`);

  return NextResponse.json({ ok: true });
}
