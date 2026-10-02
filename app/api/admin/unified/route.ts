import { NextResponse } from "next/server";
import { listSubmissions, SUBMISSION_FIELDS, SUBMISSION_QUEUE_FIELDS } from "../../../../src/lib/airtable";
import { QUEUE_CACHE_TTL_MS } from "../../../../src/lib/submissionSearch";
import { lookupUnifiedForRecords } from "../../../../src/lib/unified";
import { RECORD_ID_PATTERN, requireQueueAccess } from "../../../../src/lib/queueAuth";

// Loaded per row by the queue after it renders, so Unified's response time
// never sits on the page's critical path. The record's URLs come from the
// same cached full scan the queue pages already use.
export async function GET(request: Request) {
  if (!(await requireQueueAccess(request))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!RECORD_ID_PATTERN.test(id)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const records = await listSubmissions(undefined, SUBMISSION_QUEUE_FIELDS, QUEUE_CACHE_TTL_MS);
  const record = records.find((r) => r.id === id);
  if (!record) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const result = await lookupUnifiedForRecords([
    {
      id,
      urls: [
        String(record.fields[SUBMISSION_FIELDS.playableUrl] ?? ""),
        String(record.fields[SUBMISSION_FIELDS.codeUrl] ?? ""),
      ],
    },
  ]);
  return NextResponse.json(result.get(id) ?? { status: "unavailable" });
}
