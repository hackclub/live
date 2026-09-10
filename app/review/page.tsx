import { redirect } from "next/navigation";
import { getSession } from "../../src/lib/auth";
import { isAdminEmail, isReviewerEmail } from "../../src/lib/admin";
import { getIdentity } from "../../src/lib/hackclub";
import {
  BANNED_USER_FIELDS,
  listBannedUsers,
  listMessagesBySubmissionIds,
  listSubmissions,
  SUBMISSION_FIELDS,
} from "../../src/lib/airtable";
import AdminQueue, { type AdminSubmissionRow } from "../components/admin/AdminQueue";

// Reviewer-scoped variant of /admin — same queue-building logic as
// app/admin/page.tsx (duplicated rather than factored out for now, see
// design.md decision 3), minus the Telescreen link, timer-control link, and
// any submission belonging to the reviewer themselves.
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
  // Fetched only to filter out the reviewer's own submission server-side —
  // never included in AdminSubmissionRow or sent to the client.
  SUBMISSION_FIELDS.email,
];

const DUPLICATE_CHECK_FIELDS = [
  SUBMISSION_FIELDS.codeUrl,
  SUBMISSION_FIELDS.approved,
  SUBMISSION_FIELDS.reviewStatus,
  SUBMISSION_FIELDS.overrideHours,
  // Fetched only for the server-side banned-user cross-reference below —
  // never included in AdminSubmissionRow or sent to the client.
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

function filterFormula(status: "Pending" | "Approved" | "Rejected" | "Fraud") {
  if (status === "Approved") return `{${SUBMISSION_FIELDS.approved}} = TRUE()`;
  if (status === "Pending") {
    return `AND({${SUBMISSION_FIELDS.approved}} = FALSE(), OR({${SUBMISSION_FIELDS.reviewStatus}} = 'Pending', {${SUBMISSION_FIELDS.reviewStatus}} = ''))`;
  }
  return `{${SUBMISSION_FIELDS.reviewStatus}} = '${status}'`;
}

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getSession();
  if (!session?.access_token) redirect("/api/auth/login");

  const identity = await getIdentity(session.access_token);
  const email = identity?.primary_email;
  if (!email || (!isAdminEmail(email) && !isReviewerEmail(email))) {
    redirect("/");
  }

  const status = ((await searchParams).status as "Pending" | "Approved" | "Rejected" | "Fraud") ?? "Pending";
  const allRecordsForStatus = await listSubmissions(filterFormula(status), QUEUE_FIELDS);
  // Reviewers never see their own submission, in any status tab.
  const records = allRecordsForStatus.filter(
    (record) => String(record.fields[SUBMISSION_FIELDS.email] ?? "").trim().toLowerCase() !== email.toLowerCase(),
  );

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
      messages: messagesBySubmission.get(record.id) ?? [],
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
      <AdminQueue rows={rows} filter={status} showTelescreenLink={false} isAdmin={isAdminEmail(email)} />
    </section>
  );
}
