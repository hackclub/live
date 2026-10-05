import { NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../../src/lib/auth";
import { isAdminEmail } from "../../../../../src/lib/admin";
import { getIdentity } from "../../../../../src/lib/hackclub";
import { buildRefundPlan, refundBatch } from "../../../../../src/lib/refundAll";

export const dynamic = "force-dynamic";

const BATCH_SIZE = 20;
const CONFIRM_PHRASE = "REFUND ALL";

// Admin-only, same gate as app/api/admin/purchases/refund/route.ts.
async function requireAdmin(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session?.access_token) {
    return { ok: false as const, response: NextResponse.json({ error: "not_authenticated" }, { status: 401 }) };
  }
  const identity = await getIdentity(session.access_token);
  if (!identity?.primary_email || !isAdminEmail(identity.primary_email)) {
    return { ok: false as const, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { ok: true as const };
}

// Dry run: what a refund-all would do, plus a backup of every Redemptions row.
export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildRefundPlan());
}

// Deletes one batch of refundable rows; the client calls this until
// `remaining` is 0. Requires the typed confirmation phrase every call.
export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if ((body as { confirm?: unknown })?.confirm !== CONFIRM_PHRASE) {
    return NextResponse.json({ error: "confirmation_required" }, { status: 400 });
  }

  return NextResponse.json(await refundBatch(BATCH_SIZE));
}
