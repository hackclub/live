import { NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../src/lib/auth";
import { isAdminEmail } from "../../../../src/lib/admin";
import {
  createMessage,
  MESSAGE_SENDER,
  REVIEW_STATUS,
  SUBMISSION_FIELDS,
  updateAirtableRecord,
} from "../../../../src/lib/airtable";
import { getIdentity } from "../../../../src/lib/hackclub";

const ACTIONS = ["approve", "reject", "fraud", "hours"] as const;
type Action = (typeof ACTIONS)[number];

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session?.access_token) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  const identity = await getIdentity(session.access_token);
  if (!identity?.primary_email || !isAdminEmail(identity.primary_email)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const recordId = String(body.recordId ?? "");
  const action = String(body.action ?? "") as Action;
  const message = String(body.message ?? "").trim();

  if (!recordId || !ACTIONS.includes(action)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (action === "reject" && !message) {
    return NextResponse.json({ error: "message_required" }, { status: 400 });
  }

  const reviewedAt = new Date().toISOString();

  // "hours" is an adjustment action, not a verdict — it only rewrites the
  // record's hours (letting a reviewer deflate an over-counted Hackatime
  // figure before approving) and leaves Approved / Review Status untouched.
  if (action === "hours") {
    const hours = Number(body.hours);
    if (!Number.isFinite(hours) || hours < 0) {
      return NextResponse.json({ error: "invalid_hours" }, { status: 400 });
    }
    await updateAirtableRecord(recordId, {
      [SUBMISSION_FIELDS.overrideHours]: Math.round(hours * 10) / 10,
      [SUBMISSION_FIELDS.reviewedAt]: reviewedAt,
      [SUBMISSION_FIELDS.reviewedBy]: identity.primary_email,
    });
    return NextResponse.json({ ok: true });
  }

  const reviewFields: Record<string, unknown> = {
    [SUBMISSION_FIELDS.reviewedAt]: reviewedAt,
    [SUBMISSION_FIELDS.reviewedBy]: identity.primary_email,
  };

  // Approve is a lighter-weight, independent action — its own field, no
  // message required — distinct from Reject/Fraud which write Review Status.
  if (action === "approve") {
    reviewFields[SUBMISSION_FIELDS.approved] = true;
  } else if (action === "reject") {
    reviewFields[SUBMISSION_FIELDS.reviewStatus] = REVIEW_STATUS.rejected;
  } else {
    // Fraud is terminal and single-record only — no cascading block on
    // future submissions from the same person.
    reviewFields[SUBMISSION_FIELDS.reviewStatus] = REVIEW_STATUS.fraud;
  }

  await updateAirtableRecord(recordId, reviewFields);

  if (message) {
    await createMessage({
      submissionRecordId: recordId,
      sender: MESSAGE_SENDER.admin,
      message,
    });
  }

  return NextResponse.json({ ok: true });
}
