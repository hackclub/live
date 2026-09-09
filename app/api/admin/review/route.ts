import { NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../src/lib/auth";
import { isAdminEmail, isReviewerEmail } from "../../../../src/lib/admin";
import {
  createMessage,
  getSubmissionById,
  MESSAGE_SENDER,
  REVIEW_STATUS,
  SUBMISSION_FIELDS,
  updateAirtableRecord,
} from "../../../../src/lib/airtable";
import { getIdentity } from "../../../../src/lib/hackclub";
import { payReferral } from "../../../../src/lib/referral";

const ACTIONS = ["approve", "reject", "fraud", "hours"] as const;
type Action = (typeof ACTIONS)[number];

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session?.access_token) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  const identity = await getIdentity(session.access_token);
  const isAdmin = Boolean(identity?.primary_email && isAdminEmail(identity.primary_email));
  const isReviewer = Boolean(identity?.primary_email && isReviewerEmail(identity.primary_email));
  if (!identity?.primary_email || (!isAdmin && !isReviewer)) {
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

  // Neither role may review their own submission — re-checked here
  // server-side regardless of what the caller's queue displayed, since
  // recordId is client-supplied.
  const target = await getSubmissionById(recordId);
  const targetEmail = String(target?.fields[SUBMISSION_FIELDS.email] ?? "").trim();
  if (targetEmail && targetEmail.toLowerCase() === identity.primary_email.toLowerCase()) {
    return NextResponse.json({ error: "cannot_review_own_submission" }, { status: 403 });
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
    const hoursFields: Record<string, unknown> = {
      [SUBMISSION_FIELDS.overrideHours]: Math.round(hours * 10) / 10,
      [SUBMISSION_FIELDS.reviewedAt]: reviewedAt,
      [SUBMISSION_FIELDS.reviewedBy]: identity.primary_email,
    };
    if (body.justification !== undefined) {
      hoursFields[SUBMISSION_FIELDS.overrideHoursJustification] = String(body.justification).trim();
    }
    await updateAirtableRecord(recordId, hoursFields);
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

    // Hours + justification are optional on approve — a reviewer can approve
    // without touching them, or set the final hours and why in one request.
    if (body.hours !== undefined) {
      const hours = Number(body.hours);
      if (!Number.isFinite(hours) || hours < 0) {
        return NextResponse.json({ error: "invalid_hours" }, { status: 400 });
      }
      reviewFields[SUBMISSION_FIELDS.overrideHours] = Math.round(hours * 10) / 10;
      reviewFields[SUBMISSION_FIELDS.overrideHoursJustification] = String(
        body.justification ?? "",
      ).trim();
    }
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

  // Referral payout: if this approved submission's submitter was referred,
  // grant the referrer one free water balloon. Idempotent and best-effort —
  // never fails the review action.
  if (action === "approve") {
    try {
      if (targetEmail) {
        const outcome = await payReferral(targetEmail, recordId);
        if (outcome !== "skipped") {
          console.log(`[referral] payout for ${targetEmail} on approve: ${outcome}`);
        }
      }
    } catch (err) {
      console.error("[referral] payout on approve failed", err);
    }
  }

  return NextResponse.json({ ok: true });
}
