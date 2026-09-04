import { NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../src/lib/auth";
import { REFERRAL_SOURCE } from "../../../../src/lib/airtable";
import { getIdentity } from "../../../../src/lib/hackclub";
import { bindReferral } from "../../../../src/lib/referral";

// Typed referral-code entry from /dashboard. The link path binds automatically
// in the hackatime OAuth callback; this is the "I have a code" fallback.
export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session?.access_token) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  const identity = await getIdentity(session.access_token);
  if (!identity?.primary_email) {
    return NextResponse.json({ error: "identity_unavailable" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const code = String(body.code ?? "").trim();
  if (!code) {
    return NextResponse.json({ error: "unknown_code" }, { status: 400 });
  }

  const result = await bindReferral({
    refereeEmail: identity.primary_email,
    handle: code,
    source: REFERRAL_SOURCE.code,
  });

  if (result.ok) {
    return NextResponse.json({ ok: true, referrerHandle: result.referrerHandle });
  }
  return NextResponse.json({ error: result.reason }, { status: 400 });
}
