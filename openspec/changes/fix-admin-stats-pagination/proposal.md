## Why

The `/admin` review dashboard's stat tiles (approved/rejected/fraud hours and
project counts, percent-approved, review progress) and the per-status queue
tabs are all derived from `listSubmissions()` in `src/lib/airtable.ts`, which
issues exactly one Airtable list request and returns whatever comes back.
Airtable's list endpoint silently caps each response at 100 records and hands
back an `offset` token for the rest; since `listSubmissions()` never follows
that token, once the `YSWS Project Submission` table holds more than 100
records matching a query, the remainder are dropped with no error. Every stat
tile and any queue tab that crosses that threshold shows numbers computed off
an arbitrary partial slice, not the true totals — the "dashboard stats are
fake" symptom.

The same file already implements correct offset-following pagination in
`countApprovedHours()`, `sumRedeemedCost()`, `listAllRedemptions()`,
`listRedemptionsByEmail()`, and `listMessagesBySubmissionIds()`, so this is a
localized gap, not a new pattern to invent.

## What Changes

- Fix `listSubmissions()` in `src/lib/airtable.ts` to loop over Airtable's
  `offset` pagination token (same shape as `countApprovedHours()`) so it
  returns every record matching the query, not just the first page.
- No changes to `app/admin/page.tsx`'s stat-computation loop or UI — it
  already computes correctly from `allRecords`; it just needs `allRecords` to
  actually contain all records.

## Capabilities

### New Capabilities
- `airtable-full-list-reads`: Airtable list-style reads used for aggregate
  counts or full-table scans (not capped by an explicit `maxRecords`) must
  page through all results via the `offset` token rather than returning only
  the first page.

### Modified Capabilities
(none — no existing spec in `openspec/specs/` covers admin review stats or
Airtable read behavior yet)

## Impact

- `src/lib/airtable.ts`: `listSubmissions()` implementation only — signature
  and return type (`Promise<AirtableRecord[]>`) unchanged, so every existing
  caller (`app/admin/page.tsx`'s queue fetch and stats scan, and any other
  caller) keeps working without modification, now against the complete result
  set.
- No Airtable schema changes, no new API routes, no data writes.
- Out of scope (tracked as a known follow-up, not part of this change):
  `getPersonalApprovedHours()` and `listSubmissionsByEmail()` in the same
  file have the same unpaginated pattern, used by the per-user `/dashboard`
  page. Lower risk (would require one person to exceed 100 submissions) and
  intentionally left out of this change to keep it scoped to the reported
  admin-dashboard symptom.
