import { redirect } from "next/navigation";
import { getSession } from "../../src/lib/auth";
import { isAdminEmail } from "../../src/lib/admin";
import { getIdentity } from "../../src/lib/hackclub";
import {
  BANNED_USER_FIELDS,
  listBannedUsers,
  listMessagesBySubmissionIds,
  listSubmissions,
  SUBMISSION_FIELDS,
} from "../../src/lib/airtable";
import AdminQueue, { type AdminSubmissionRow } from "../components/admin/AdminQueue";

const TELESCREEN_BASE = "https://telescreen.hackclub.com/workbench/hackatime/overview";
// https://telescreen.hackclub.com/workbench/hackatime/overview?u=3353&p=gofan-front
// Only the fields needed to render the queue are ever fetched from
// Airtable — Name/Email/Address/Birthday are never requested, so they can't
// leak into this page's payload even by accident.
const QUEUE_FIELDS = [
  SUBMISSION_FIELDS.hackatimeId,
  SUBMISSION_FIELDS.hackatimeProjects,
  SUBMISSION_FIELDS.overrideHours,
  SUBMISSION_FIELDS.description,
  SUBMISSION_FIELDS.codeUrl,
  SUBMISSION_FIELDS.playableUrl,
  SUBMISSION_FIELDS.lapseLinks,
  SUBMISSION_FIELDS.screenshot,
  SUBMISSION_FIELDS.approved,
  SUBMISSION_FIELDS.reviewStatus,
  SUBMISSION_FIELDS.reviewerVerdict,
  SUBMISSION_FIELDS.reviewerJustification,
  SUBMISSION_FIELDS.reviewerHours,
  SUBMISSION_FIELDS.reviewerReviewedBy,
];

const DUPLICATE_CHECK_FIELDS = [
  SUBMISSION_FIELDS.codeUrl,
  SUBMISSION_FIELDS.approved,
  SUBMISSION_FIELDS.reviewStatus,
  SUBMISSION_FIELDS.overrideHours,
  SUBMISSION_FIELDS.overrideHoursJustification,
  // Fetched only for the server-side banned-user cross-reference below —
  // never included in AdminSubmissionRow or sent to the client (QUEUE_FIELDS
  // above is the client-facing field allowlist, and never includes email).
  SUBMISSION_FIELDS.email,
];

// Treats cosmetically different links to the same project as the same
// Code URL — admins paste these by hand and rarely agree on protocol/www.
function normalizeCodeUrl(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

type Status = "Pending" | "Prereviewed" | "Approved" | "Rejected" | "Fraud";

function filterFormula(status: Status) {
  if (status === "Approved") return `{${SUBMISSION_FIELDS.approved}} = TRUE()`;
  if (status === "Prereviewed") {
    return `AND({${SUBMISSION_FIELDS.reviewerVerdict}} != '', {${SUBMISSION_FIELDS.approved}} = FALSE(), OR({${SUBMISSION_FIELDS.reviewStatus}} = 'Pending', {${SUBMISSION_FIELDS.reviewStatus}} = ''))`;
  }
  if (status === "Pending") {
    return `AND({${SUBMISSION_FIELDS.approved}} = FALSE(), OR({${SUBMISSION_FIELDS.reviewStatus}} = 'Pending', {${SUBMISSION_FIELDS.reviewStatus}} = ''), {${SUBMISSION_FIELDS.reviewerVerdict}} = '')`;
  }
  return `{${SUBMISSION_FIELDS.reviewStatus}} = '${status}'`;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getSession();
  if (!session?.access_token) redirect("/api/auth/login");

  const identity = await getIdentity(session.access_token);
  if (!identity?.primary_email || !isAdminEmail(identity.primary_email)) {
    redirect("/");
  }

  const status = ((await searchParams).status as Status) ?? "Pending";
  const records = await listSubmissions(filterFormula(status), QUEUE_FIELDS);

  const messagesBySubmission = await listMessagesBySubmissionIds(records.map((r) => r.id));

  // Cross-status scan so a duplicate/already-approved Code URL is flagged
  // no matter which status tab it's being viewed from.
  const allRecords = await listSubmissions(undefined, DUPLICATE_CHECK_FIELDS);

  // Server-side only: banned emails are never attached to AdminSubmissionRow,
  // only reduced to a per-record `isBanned` boolean below.
  const bannedUserRecords = await listBannedUsers();
  const bannedEmails = new Set(
    bannedUserRecords.map((r) => String(r.fields[BANNED_USER_FIELDS.email] ?? "").trim().toLowerCase()).filter(Boolean),
  );
  const bannedRecordIds = new Set<string>();

  const groupsByCodeUrl = new Map<string, { id: string; approved: boolean }[]>();
  let unreviewedCount = 0;
  let unreviewedHours = 0;
  let approvedProjects = 0;
  let approvedHours = 0;
  let rejectedProjects = 0;
  let rejectedHours = 0;
  let fraudProjects = 0;
  let fraudHours = 0;
  for (const record of allRecords) {
    const codeUrl = String(record.fields[SUBMISSION_FIELDS.codeUrl] ?? "").trim();
    if (codeUrl) {
      const key = normalizeCodeUrl(codeUrl);
      const group = groupsByCodeUrl.get(key) ?? [];
      group.push({ id: record.id, approved: Boolean(record.fields[SUBMISSION_FIELDS.approved]) });
      groupsByCodeUrl.set(key, group);
    }

    const email = String(record.fields[SUBMISSION_FIELDS.email] ?? "").trim().toLowerCase();
    if (email && bannedEmails.has(email)) bannedRecordIds.add(record.id);

    const approved = Boolean(record.fields[SUBMISSION_FIELDS.approved]);
    const reviewStatus = String(record.fields[SUBMISSION_FIELDS.reviewStatus] ?? "Pending");
    const isPendingStatus = reviewStatus === "Pending" || reviewStatus === "";
    const justification = String(record.fields[SUBMISSION_FIELDS.overrideHoursJustification] ?? "").trim();
    const hoursRaw = record.fields[SUBMISSION_FIELDS.overrideHours];
    const hours = typeof hoursRaw === "number" ? hoursRaw : 0;

    if (!approved && isPendingStatus) {
      unreviewedCount += 1;
      if (!justification) unreviewedHours += hours;
    }

    if (approved) {
      approvedProjects += 1;
      approvedHours += hours;
    } else if (reviewStatus === "Rejected") {
      rejectedProjects += 1;
      rejectedHours += hours;
    } else if (reviewStatus === "Fraud") {
      fraudProjects += 1;
      fraudHours += hours;
    }
  }
  const queueCount = allRecords.length;
  const reviewedTotal = approvedProjects + rejectedProjects + fraudProjects;
  const remainingToReview = queueCount - reviewedTotal;
  const percentApproved = reviewedTotal === 0 ? null : Math.round((approvedProjects / reviewedTotal) * 1000) / 10;

  const rows: AdminSubmissionRow[] = records.map((record) => {
    const codeUrl = String(record.fields[SUBMISSION_FIELDS.codeUrl] ?? "").trim();
    const group = codeUrl ? groupsByCodeUrl.get(normalizeCodeUrl(codeUrl)) ?? [] : [];
    const others = group.filter((r) => r.id !== record.id);
    const duplicateRecordIds = others.map((r) => r.id);
    const duplicateHasApproved = others.some((r) => r.approved);
    return buildRow(record, duplicateRecordIds, duplicateHasApproved, bannedRecordIds.has(record.id));
  });

  function buildRow(
    record: (typeof records)[number],
    duplicateRecordIds: string[],
    duplicateHasApproved: boolean,
    isBanned: boolean,
  ): AdminSubmissionRow {
    const hackatimeId = String(record.fields[SUBMISSION_FIELDS.hackatimeId] ?? "");
    const screenshot = record.fields[SUBMISSION_FIELDS.screenshot] as
      | Array<{ url: string }>
      | undefined;
    const hoursRaw = record.fields[SUBMISSION_FIELDS.overrideHours];
    const reviewerVerdictRaw = record.fields[SUBMISSION_FIELDS.reviewerVerdict];
    const reviewerHoursRaw = record.fields[SUBMISSION_FIELDS.reviewerHours];
    return {
      id: record.id,
      hackatimeId,
      telescreenLink: `${TELESCREEN_BASE}?u=${encodeURIComponent(hackatimeId)}`,
      codeUrl: String(record.fields[SUBMISSION_FIELDS.codeUrl] ?? ""),
      playableUrl: String(record.fields[SUBMISSION_FIELDS.playableUrl] ?? ""),
      lapseLinks: String(record.fields[SUBMISSION_FIELDS.lapseLinks] ?? ""),
      hackatimeProjects: String(record.fields[SUBMISSION_FIELDS.hackatimeProjects] ?? ""),
      description: String(record.fields[SUBMISSION_FIELDS.description] ?? ""),
      hours: typeof hoursRaw === "number" ? hoursRaw : 0,
      screenshotUrl: screenshot?.[0]?.url ?? null,
      approved: Boolean(record.fields[SUBMISSION_FIELDS.approved]),
      reviewStatus: String(record.fields[SUBMISSION_FIELDS.reviewStatus] ?? "Pending"),
      messages: messagesBySubmission.get(record.id) ?? [],
      duplicateRecordIds,
      duplicateHasApproved,
      isBanned,
      reviewerVerdict: reviewerVerdictRaw === "Approve" || reviewerVerdictRaw === "Reject" ? reviewerVerdictRaw : null,
      reviewerJustification: String(record.fields[SUBMISSION_FIELDS.reviewerJustification] ?? ""),
      reviewerHours: typeof reviewerHoursRaw === "number" ? reviewerHoursRaw : null,
      reviewerReviewedBy: String(record.fields[SUBMISSION_FIELDS.reviewerReviewedBy] ?? ""),
    };
  }

  return (
    <section className="w-4/6 mx-auto min-h-screen py-10 flex flex-col gap-6">
      <div className="flex items-baseline gap-4">
        <p className="text-4xl">review queue.</p>
        <a href="/admin/timer" className="link opacity-70">
          timer control →
        </a>
        <a href="/admin/purchases" className="link opacity-70">
          purchases →
        </a>
        <a href="/admin/referrals" className="link opacity-70">
          referrals →
        </a>
        <a href="/admin/banned" className="link opacity-70">
          banned →
        </a>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-sm opacity-70">
          <span>
            {reviewedTotal} / {queueCount} reviewed
          </span>
          <span>{remainingToReview > 0 ? `${remainingToReview} more to review` : "all caught up"}</span>
        </div>
        <progress
          className="progress progress-primary w-full"
          value={reviewedTotal}
          max={queueCount || 1}
        />
      </div>
      <div className="stats stats-vertical sm:stats-horizontal bg-base-200 shadow">
        <div className="stat">
          <div className="stat-title">Unreviewed</div>
          <div className="stat-value">{unreviewedCount}</div>
          <div className="stat-desc">{Math.round(unreviewedHours * 10) / 10} hrs</div>
        </div>
        <div className="stat">
          <div className="stat-title">In queue</div>
          <div className="stat-value">{queueCount}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Percent approved</div>
          <div className="stat-value">{percentApproved === null ? "—" : `${percentApproved}%`}</div>
        </div>
      </div>
      <div className="stats stats-vertical sm:stats-horizontal bg-base-200 shadow">
        <div className="stat">
          <div className="stat-title">Approved</div>
          <div className="stat-value">{approvedProjects}</div>
          <div className="stat-desc">{Math.round(approvedHours * 10) / 10} hrs</div>
        </div>
        <div className="stat">
          <div className="stat-title">Rejected</div>
          <div className="stat-value">{rejectedProjects}</div>
          <div className="stat-desc">{Math.round(rejectedHours * 10) / 10} hrs</div>
        </div>
        <div className="stat">
          <div className="stat-title">Fraud</div>
          <div className="stat-value">{fraudProjects}</div>
          <div className="stat-desc">{Math.round(fraudHours * 10) / 10} hrs</div>
        </div>
      </div>
      <AdminQueue rows={rows} filter={status} isAdmin />
    </section>
  );
}
