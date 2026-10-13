import { NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../../src/lib/auth";
import { isAdminEmail } from "../../../../../src/lib/admin";
import { getIdentity } from "../../../../../src/lib/hackclub";
import {
  getRedemptionsByIds,
  isAirtableRecordId,
  REDEMPTION_FIELDS,
  updateRedemptionRecords,
} from "../../../../../src/lib/airtable";

export const dynamic = "force-dynamic";

// One dashboard line is at most a few dozen rows; this just bounds abuse.
const MAX_RECORDS = 200;

// Same identity check as app/api/admin/purchases/refund/route.ts.
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

// Marks redemptions fulfilled (stamps Fulfilled At / Fulfilled By) or
// unfulfilled (clears both). Touches no other field — Status stays unused.
// The client sends only record ids, never emails; ownership is re-checked
// here so an admin can't fulfill their own purchase.
export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const { recordIds, fulfilled } = (body ?? {}) as { recordIds?: unknown; fulfilled?: unknown };
  if (
    !Array.isArray(recordIds) ||
    recordIds.length === 0 ||
    recordIds.length > MAX_RECORDS ||
    !recordIds.every(isAirtableRecordId) ||
    typeof fulfilled !== "boolean"
  ) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const ids = Array.from(new Set(recordIds));

  const records = await getRedemptionsByIds(ids);
  if (records.length !== ids.length) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const adminEmail = gate.email.trim().toLowerCase();
  const ownsAny = records.some(
    (record) => String(record.fields[REDEMPTION_FIELDS.email] ?? "").trim().toLowerCase() === adminEmail,
  );
  if (ownsAny) {
    return NextResponse.json({ error: "cannot_fulfill_own_purchase" }, { status: 403 });
  }

  const fields = fulfilled
    ? { [REDEMPTION_FIELDS.fulfilledAt]: new Date().toISOString(), [REDEMPTION_FIELDS.fulfilledBy]: gate.email }
    : { [REDEMPTION_FIELDS.fulfilledAt]: null, [REDEMPTION_FIELDS.fulfilledBy]: null };
  const result = await updateRedemptionRecords(ids.map((id) => ({ id, fields })));

  return NextResponse.json(result, { status: result.updated.length === 0 ? 502 : 200 });
}
