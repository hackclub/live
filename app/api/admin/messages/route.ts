import { NextResponse } from "next/server";
import { listMessagesBySubmissionIds } from "../../../../src/lib/airtable";
import { RECORD_ID_PATTERN, requireQueueAccess } from "../../../../src/lib/queueAuth";

// Message threads are only shown inside a collapsed section, so the queue
// fetches them on demand instead of scanning the messages table on every load.
export async function GET(request: Request) {
  if (!(await requireQueueAccess(request))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!RECORD_ID_PATTERN.test(id)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const grouped = await listMessagesBySubmissionIds([id]);
  return NextResponse.json({ messages: grouped.get(id) ?? [] });
}
