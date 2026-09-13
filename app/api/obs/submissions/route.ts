import { NextResponse } from "next/server";
import { listSubmissionsCreatedAfter, SUBMISSION_FIELDS } from "../../../../src/lib/airtable";
import { clientIp, rateLimit } from "../../../../src/lib/rateLimit";

// Unauthenticated on purpose — see app/api/obs/timer/route.ts.
export const dynamic = "force-dynamic";

const BACKFILL_MAX_RECORDS = 20;

export async function GET(request: Request) {
  if (!rateLimit(`obs-submissions:${clientIp(request)}`, 120, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // `since` is echoed straight into an Airtable filterByFormula downstream,
  // so anything that isn't a real timestamp is dropped here rather than
  // trusted — a non-date value would otherwise be a formula-injection
  // vector on this unauthenticated endpoint.
  const rawSince = new URL(request.url).searchParams.get("since");
  const since =
    rawSince && !Number.isNaN(Date.parse(rawSince))
      ? new Date(rawSince).toISOString()
      : null;

  const records = await listSubmissionsCreatedAfter(
    since,
    since ? {} : { maxRecords: BACKFILL_MAX_RECORDS },
  );

  const items = records.map((record) => {
    const hours = record.fields[SUBMISSION_FIELDS.overrideHours];
    return {
      githubUsername: String(record.fields[SUBMISSION_FIELDS.githubUsername] ?? ""),
      hoursClaimed: typeof hours === "number" ? hours : null,
      submittedAt: record.createdTime ?? null,
    };
  });

  return NextResponse.json(items, {
    headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=25" },
  });
}
