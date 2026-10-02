import { redirect } from "next/navigation";
import { getSession } from "../../src/lib/auth";
import { isAdminEmail, isReviewerEmail } from "../../src/lib/admin";
import { getIdentity } from "../../src/lib/hackclub";
import {
  BANNED_USER_FIELDS,
  listBannedUsers,
  getQueueSnapshot,
  SUBMISSION_FIELDS,
} from "../../src/lib/airtable";
import { matchesSearch, normalizeQuery, parseLimit } from "../../src/lib/submissionSearch";
import AdminQueue, { type AdminSubmissionRow } from "../components/admin/AdminQueue";

// Reviewer-scoped variant of /admin — same queue-building logic as
// app/admin/page.tsx (duplicated rather than factored out for now, see
// design.md decision 3), minus the Telescreen link, timer-control link, and
// any submission belonging to the reviewer themselves. Fetches with the same
// SUBMISSION_QUEUE_FIELDS array as app/admin/page.tsx on purpose, so the two
// pages' full-table scans land on the same Airtable GET-cache entry instead
// of each running its own near-identical scan.

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

type ReviewStatus = "Pending" | "Prereviewed" | "Approved" | "Rejected" | "Fraud";

const REVIEW_STATUSES: ReviewStatus[] = ["Pending", "Prereviewed", "Approved", "Rejected", "Fraud"];

function parseStatus(value: string | undefined): ReviewStatus {
  return REVIEW_STATUSES.find((status) => status === value) ?? "Pending";
}

// Same tab logic the old Airtable filterByFormula strings encoded, now
// applied client-side against the single full-table scan below.
function matchesStatus(fields: Record<string, unknown>, status: ReviewStatus, email: string): boolean {
  const approved = Boolean(fields[SUBMISSION_FIELDS.approved]);
  const reviewStatus = String(fields[SUBMISSION_FIELDS.reviewStatus] ?? "");
  if (status === "Approved") return approved;
  if (status === "Prereviewed") {
    // The reviewer's own recommendations that an admin hasn't finalized yet,
    // so they can still read back what they wrote.
    const isPendingReviewStatus = reviewStatus === "Pending" || reviewStatus === "";
    const reviewedBy = String(fields[SUBMISSION_FIELDS.reviewerReviewedBy] ?? "").trim().toLowerCase();
    return (
      !approved &&
      isPendingReviewStatus &&
      String(fields[SUBMISSION_FIELDS.reviewerVerdict] ?? "") !== "" &&
      reviewedBy === email.toLowerCase()
    );
  }
  if (status === "Pending") {
    // Excludes submissions someone has already prechecked — those move to
    // the admin's Prereviewed queue and shouldn't linger in a reviewer's
    // Pending tab pending a second, redundant precheck.
    const isPendingReviewStatus = reviewStatus === "Pending" || reviewStatus === "";
    const reviewerVerdict = String(fields[SUBMISSION_FIELDS.reviewerVerdict] ?? "");
    return !approved && isPendingReviewStatus && reviewerVerdict === "";
  }
  return reviewStatus === status;
}

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; limit?: string }>;
}) {
  const session = await getSession();
  if (!session?.access_token) redirect("/api/auth/login");

  const identity = await getIdentity(session.access_token);
  const email = identity?.primary_email;
  if (!email || (!isAdminEmail(email) && !isReviewerEmail(email))) {
    redirect("/");
  }

  const params = await searchParams;
  const status = parseStatus(params.status);
  const query = normalizeQuery(params.q);
  const limit = parseLimit(params.limit);

  // One full-table scan serves both the active status tab and the
  // cross-status duplicate/stats view below (and, via the shared
  // SUBMISSION_QUEUE_FIELDS cache key, an /admin load's identical scan).
  const [allRecords, bannedUserRecords] = await Promise.all([
    getQueueSnapshot(),
    // Banned emails stay server-side and are reduced to a boolean below.
    listBannedUsers(),
  ]);
  // A search spans every status; otherwise show the active tab.
  const allRecordsForStatus = allRecords.filter((record) =>
    query ? matchesSearch(record, query) : matchesStatus(record.fields, status, email),
  );
  // Reviewers never see their own submission, in any status tab.
  const records = allRecordsForStatus.filter(
    (record) => String(record.fields[SUBMISSION_FIELDS.email] ?? "").trim().toLowerCase() !== email.toLowerCase(),
  );

  const bannedEmails = new Set(
    bannedUserRecords.map((r) => String(r.fields[BANNED_USER_FIELDS.email] ?? "").trim().toLowerCase()).filter(Boolean),
  );
  const bannedRecordIds = new Set<string>();

  const groupsByCodeUrl = new Map<string, { id: string; approved: boolean }[]>();
  let unreviewedCount = 0;
  let totalHours = 0;
  for (const record of allRecords) {
    const codeUrl = String(record.fields[SUBMISSION_FIELDS.codeUrl] ?? "").trim();
    if (codeUrl) {
      const key = normalizeCodeUrl(codeUrl);
      const group = groupsByCodeUrl.get(key) ?? [];
      group.push({ id: record.id, approved: Boolean(record.fields[SUBMISSION_FIELDS.approved]) });
      groupsByCodeUrl.set(key, group);
    }

    const recordEmail = String(record.fields[SUBMISSION_FIELDS.email] ?? "").trim().toLowerCase();
    if (recordEmail && bannedEmails.has(recordEmail)) bannedRecordIds.add(record.id);

    const approved = Boolean(record.fields[SUBMISSION_FIELDS.approved]);
    const reviewStatus = String(record.fields[SUBMISSION_FIELDS.reviewStatus] ?? "Pending");
    if (!approved && (reviewStatus === "Pending" || reviewStatus === "")) unreviewedCount += 1;

    const hoursRaw = record.fields[SUBMISSION_FIELDS.overrideHours];
    if (typeof hoursRaw === "number") totalHours += hoursRaw;
  }
  const queueCount = allRecords.length;

  const rows: AdminSubmissionRow[] = records.slice(0, limit).map((record) => {
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
    return {
      id: record.id,
      hackatimeId,
      // No telescreenLink — reviewers don't get a link to the submitter's
      // Hackatime overview, only the ID text (rendered by AdminQueue).
      codeUrl: String(record.fields[SUBMISSION_FIELDS.codeUrl] ?? ""),
      playableUrl: String(record.fields[SUBMISSION_FIELDS.playableUrl] ?? ""),
      lapseLinks: String(record.fields[SUBMISSION_FIELDS.lapseLinks] ?? ""),
      hackatimeProjects: String(record.fields[SUBMISSION_FIELDS.hackatimeProjects] ?? ""),
      description: String(record.fields[SUBMISSION_FIELDS.description] ?? ""),
      hours: typeof hoursRaw === "number" ? hoursRaw : 0,
      screenshotUrl: screenshot?.[0]?.url ?? null,
      approved: Boolean(record.fields[SUBMISSION_FIELDS.approved]),
      reviewStatus: String(record.fields[SUBMISSION_FIELDS.reviewStatus] ?? "Pending"),
      duplicateRecordIds,
      duplicateHasApproved,
      isBanned,
    };
  }

  return (
    <section className="w-4/6 mx-auto min-h-screen py-10 flex flex-col gap-6">
      <div className="flex items-baseline gap-4">
        <p className="text-4xl">review queue.</p>
      </div>
      <div className="stats stats-vertical sm:stats-horizontal bg-base-200 shadow">
        <div className="stat">
          <div className="stat-title">Unreviewed</div>
          <div className="stat-value">{unreviewedCount}</div>
        </div>
        <div className="stat">
          <div className="stat-title">In queue</div>
          <div className="stat-value">{queueCount}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Total hours</div>
          <div className="stat-value">{Math.round(totalHours * 10) / 10}</div>
        </div>
      </div>
      <AdminQueue
        rows={rows}
        filter={status}
        query={query}
        hasMore={records.length > limit}
        limit={limit}
        total={records.length}
        tabs={["Pending", "Prereviewed", "Approved", "Rejected", "Fraud"]}
        showTelescreenLink={false}
        isAdmin={isAdminEmail(email)}
        variant="review"
      />
    </section>
  );
}
