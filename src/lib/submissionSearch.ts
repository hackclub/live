import { SUBMISSION_FIELDS } from "./airtable";

// Fields a queue search matches against. Runs server-side over the records the
// page already fetched with SUBMISSION_QUEUE_FIELDS (a GET-cache hit), so a
// search costs zero extra Airtable requests and the email never reaches the
// client — only the matching rows do.
const SEARCHABLE_FIELDS = [
  SUBMISSION_FIELDS.hackatimeProjects,
  SUBMISSION_FIELDS.hackatimeId,
  SUBMISSION_FIELDS.description,
  SUBMISSION_FIELDS.codeUrl,
  SUBMISSION_FIELDS.playableUrl,
  SUBMISSION_FIELDS.lapseLinks,
  SUBMISSION_FIELDS.email,
];

export function normalizeQuery(value: string | undefined): string {
  return (value ?? "").trim().slice(0, 200);
}

// Every whitespace-separated term must appear somewhere in the record
// (case-insensitive), across all statuses.
export function matchesSearch(
  record: { id: string; fields: Record<string, unknown> },
  query: string,
): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = [record.id, ...SEARCHABLE_FIELDS.map((f) => String(record.fields[f] ?? ""))]
    .join("\n")
    .toLowerCase();
  return terms.every((term) => haystack.includes(term));
}
