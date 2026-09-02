import { redirect } from "next/navigation";
import { getSession } from "../../src/lib/auth";
import { isAdminEmail } from "../../src/lib/admin";
import { getIdentity } from "../../src/lib/hackclub";
import { listMessagesBySubmissionIds, listSubmissions, SUBMISSION_FIELDS } from "../../src/lib/airtable";
import AdminQueue, { type AdminSubmissionRow } from "../components/admin/AdminQueue";
import { parseWorkLogType, WORK_LOG_TYPE_FIELD, WORK_LOG_TYPES } from "../../src/lib/submission";

const TELESCREEN_BASE = "https://joe-cool.jollyy.dev/billy/overview";

// Only the fields needed to render the queue are ever fetched from
// Airtable — Name/Email/Address/Birthday are never requested, so they can't
// leak into this page's payload even by accident.
const QUEUE_FIELDS = [
  SUBMISSION_FIELDS.hackatimeId,
  SUBMISSION_FIELDS.codeUrl,
  SUBMISSION_FIELDS.playableUrl,
  SUBMISSION_FIELDS.lapseLinks,
  WORK_LOG_TYPE_FIELD,
  SUBMISSION_FIELDS.screenshot,
  SUBMISSION_FIELDS.approved,
  SUBMISSION_FIELDS.reviewStatus,
];

function filterFormula(status: "Pending" | "Approved" | "Rejected" | "Fraud") {
  if (status === "Approved") return `{${SUBMISSION_FIELDS.approved}} = TRUE()`;
  if (status === "Pending") {
    return `AND({${SUBMISSION_FIELDS.approved}} = FALSE(), OR({${SUBMISSION_FIELDS.reviewStatus}} = 'Pending', {${SUBMISSION_FIELDS.reviewStatus}} = ''))`;
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

  const status = ((await searchParams).status as "Pending" | "Approved" | "Rejected" | "Fraud") ?? "Pending";
  const records = await listSubmissions(filterFormula(status), QUEUE_FIELDS);

  const messagesBySubmission = await listMessagesBySubmissionIds(records.map((r) => r.id));

  const rows: AdminSubmissionRow[] = records.map((record) => {
    const hackatimeId = String(record.fields[SUBMISSION_FIELDS.hackatimeId] ?? "");
    const screenshot = record.fields[SUBMISSION_FIELDS.screenshot] as
      | Array<{ url: string }>
      | undefined;
    return {
      id: record.id,
      telescreenLink: `${TELESCREEN_BASE}?u=${encodeURIComponent(hackatimeId)}`,
      codeUrl: String(record.fields[SUBMISSION_FIELDS.codeUrl] ?? ""),
      playableUrl: String(record.fields[SUBMISSION_FIELDS.playableUrl] ?? ""),
      lapseLinks: String(record.fields[SUBMISSION_FIELDS.lapseLinks] ?? ""),
      workLogType:
        parseWorkLogType(record.fields[WORK_LOG_TYPE_FIELD]) ?? WORK_LOG_TYPES.lapse,
      screenshotUrl: screenshot?.[0]?.url ?? null,
      approved: Boolean(record.fields[SUBMISSION_FIELDS.approved]),
      reviewStatus: String(record.fields[SUBMISSION_FIELDS.reviewStatus] ?? "Pending"),
      messages: messagesBySubmission.get(record.id) ?? [],
    };
  });

  return (
    <section className="w-4/6 mx-auto min-h-screen py-10 flex flex-col gap-6">
      <div className="flex items-baseline gap-4">
        <p className="text-4xl">review queue.</p>
        <a href="/admin/timer" className="link opacity-70">
          timer control →
        </a>
      </div>
      <AdminQueue rows={rows} filter={status} />
    </section>
  );
}
