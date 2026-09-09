import { NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../../src/lib/auth";
import { isAdminEmail } from "../../../../../src/lib/admin";
import { getIdentity } from "../../../../../src/lib/hackclub";
import {
  getRedemptionById,
  listApprovedSubmissionsBeforeForEmail,
  REDEMPTION_FIELDS,
  SUBMISSION_FIELDS,
} from "../../../../../src/lib/airtable";

export const dynamic = "force-dynamic";

// Same identity check as app/api/admin/timer/route.ts.
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

// Takes only a redemption record id — the redeemer's email and the
// `beforeIso` cutoff are both looked up server-side from the redemption
// record itself, so the client never needs to (and never does) send email
// to ask for a balance snapshot.
export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;

  const redemptionId = new URL(request.url).searchParams.get("redemptionId");
  if (!redemptionId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const redemption = await getRedemptionById(redemptionId);
  if (!redemption) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const email = String(redemption.fields[REDEMPTION_FIELDS.email] ?? "");
  const redeemedAt = String(redemption.fields[REDEMPTION_FIELDS.redeemedAt] ?? "");
  if (!email || !redeemedAt) {
    return NextResponse.json({ submissions: [], totalHours: 0 });
  }

  const records = await listApprovedSubmissionsBeforeForEmail(email, redeemedAt);
  const submissions = records.map((record) => ({
    id: record.id,
    project: String(record.fields[SUBMISSION_FIELDS.hackatimeProjects] ?? ""),
    hours: Number(record.fields[SUBMISSION_FIELDS.overrideHours] ?? 0),
  }));
  const totalHours = submissions.reduce((sum, s) => sum + s.hours, 0);

  return NextResponse.json({ submissions, totalHours });
}
