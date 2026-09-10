import { NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../src/lib/auth";
import { isAdminEmail } from "../../../../src/lib/admin";
import { getIdentity } from "../../../../src/lib/hackclub";
import { banEmail, unbanEmail } from "../../../../src/lib/bans";

// Same identity check as app/api/admin/purchases/refund/route.ts — admin-only,
// no reviewer access, since this is a standalone ban-by-email entry point
// (not tied to a submission's recordId like the review queue's "ban" action).
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

export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const email = String((body as { email?: unknown })?.email ?? "").trim();
  const reason = String((body as { reason?: unknown })?.reason ?? "").trim();
  if (!email) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  await banEmail(email, gate.email, reason || undefined);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const email = String((body as { email?: unknown })?.email ?? "").trim();
  if (!email) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  await unbanEmail(email);
  return NextResponse.json({ ok: true });
}
