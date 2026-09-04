import {
  countPaidReferralsForHandle,
  createReferral,
  createRedemption,
  getReferralByRefereeEmail,
  getReferralByRefereeEmailAndStatus,
  listSubmissionsByEmail,
  markReferralPaid,
  REFERRAL_FIELDS,
  REFERRAL_SOURCE,
  REFERRAL_STATUS,
  resolveReferrerEmail,
  SUBMISSION_FIELDS,
} from "./airtable";
import { getHackatimeMe } from "./hackatime";
import type { SessionPayload } from "./session";

// First-touch referral cookie set by proxy.ts when a visitor lands on
// `/?ref=<handle>`, read once after login to bind the referee.
export const REF_COOKIE = "ref_handle";

// The prize a successful referral buys the referrer, for free. The catalog
// entry is `water balloon thrown at me`; the redemption row is labelled with
// the "(referral reward)" suffix so it reads distinctly in redemption history.
export const REFERRAL_REWARD_ITEM_NAME = "water balloon thrown at me (referral reward)";

// GitHub usernames: 1–39 chars, alphanumeric or single hyphens, no leading/
// trailing hyphen. Used to reject junk `?ref=` values and typo'd codes before
// they ever reach Airtable.
export function isPlausibleGithubUsername(value: string): boolean {
  return /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?!-)){0,38}$/.test(value) && !value.endsWith("-");
}

export type BindResult =
  | { ok: true; referrerHandle: string }
  | {
      ok: false;
      reason: "self_referral" | "already_bound" | "already_submitted" | "unknown_code";
    };

// Binds a referee to a referrer, creating one pending `Referrals` row.
// Guards, in order: plausible handle, not self, not already bound, no
// submissions yet, and (typed codes only) the handle actually resolves.
export async function bindReferral({
  refereeEmail,
  handle,
  source,
}: {
  refereeEmail: string;
  handle: string;
  source: (typeof REFERRAL_SOURCE)[keyof typeof REFERRAL_SOURCE];
}): Promise<BindResult> {
  const cleanHandle = handle.trim();
  const fromCode = source === REFERRAL_SOURCE.code;

  if (!isPlausibleGithubUsername(cleanHandle)) {
    return { ok: false, reason: "unknown_code" };
  }

  const referrerEmail = await resolveReferrerEmail(cleanHandle);

  if (referrerEmail && referrerEmail.toLowerCase() === refereeEmail.toLowerCase()) {
    return { ok: false, reason: "self_referral" };
  }

  if (await getReferralByRefereeEmail(refereeEmail)) {
    return { ok: false, reason: "already_bound" };
  }

  const ownSubmissions = await listSubmissionsByEmail(refereeEmail, [SUBMISSION_FIELDS.email]);
  if (ownSubmissions.length > 0) {
    return { ok: false, reason: "already_submitted" };
  }

  // A typed code has to point at a real person. A link can bind an
  // as-yet-unresolvable handle — payout resolves it later.
  if (fromCode && !referrerEmail) {
    return { ok: false, reason: "unknown_code" };
  }

  await createReferral({ refereeEmail, referrerHandle: cleanHandle, source });
  return { ok: true, referrerHandle: cleanHandle };
}

export type PayoutOutcome = "skipped" | "unresolved" | "paid";

// Called from admin review when a submission is approved. If the submitter is
// a pending referee, grants the referrer one free water balloon and flips the
// row to paid. Idempotent: a non-pending row yields "skipped".
export async function payReferral(
  refereeEmail: string,
  triggeringSubmissionId: string,
): Promise<PayoutOutcome> {
  const referral = await getReferralByRefereeEmailAndStatus(
    refereeEmail,
    REFERRAL_STATUS.pending,
  );
  if (!referral) return "skipped";

  const handle = String(referral.fields[REFERRAL_FIELDS.referrerHandle] ?? "");
  const referrerEmail = await resolveReferrerEmail(handle);
  if (!referrerEmail) {
    console.warn(
      `[referral] payout deferred: handle "${handle}" for referee ${refereeEmail} does not resolve to an email`,
    );
    return "unresolved";
  }

  const submissionRecordId =
    triggeringSubmissionId ||
    (referral.fields[REFERRAL_FIELDS.refereeSubmission] as string[] | undefined)?.[0] ||
    "";

  const redemption = await createRedemption({
    email: referrerEmail,
    itemName: REFERRAL_REWARD_ITEM_NAME,
    cost: 0,
  });

  await markReferralPaid({
    referralId: referral.id,
    referrerEmail,
    submissionRecordId,
    redemptionRecordId: redemption.id,
  });

  return "paid";
}

// The signed-in user's GitHub username, via the Hackatime identity leg.
export async function getCallerGithubUsername(
  session: SessionPayload,
): Promise<string | null> {
  if (!session.hackatime_access_token) return null;
  const me = await getHackatimeMe(session.hackatime_access_token);
  return me?.github_username?.trim() || null;
}

// Convenience for the dashboard: how many people this handle referred who
// shipped (also the number of balloons it earned them).
export async function getReferralStatsForHandle(handle: string): Promise<{
  referred: number;
  balloons: number;
}> {
  const referred = await countPaidReferralsForHandle(handle);
  return { referred, balloons: referred };
}
