## ADDED Requirements

### Requirement: Full-table Airtable list reads must page through all results
Any function in `src/lib/airtable.ts` intended to return every record
matching an Airtable list query (not bounded by an explicit `maxRecords`
cap) SHALL follow the Airtable API's `offset` pagination token across
multiple requests until a response is returned with no `offset`, and SHALL
return the full accumulated set of records rather than only the first page.

#### Scenario: Query matches 100 or fewer records
- **WHEN** `listSubmissions()` is called with a `filterByFormula` that
  matches 100 or fewer records
- **THEN** it returns all matching records in a single underlying request,
  identical to today's behavior

#### Scenario: Query matches more than 100 records
- **WHEN** `listSubmissions()` is called with a `filterByFormula` (or no
  filter) that matches more than 100 records in the `YSWS Project
  Submission` table
- **THEN** it issues additional requests following the `offset` token
  returned by Airtable until no `offset` remains
- **AND** the returned array contains every matching record, not just the
  first 100

#### Scenario: Admin dashboard stats reflect the full table
- **WHEN** `app/admin/page.tsx` calls `listSubmissions(undefined,
  DUPLICATE_CHECK_FIELDS)` to compute `allRecords` for its stat tiles
  (approved/rejected/fraud hours and project counts, percent-approved,
  review progress) and the submissions table holds more than 100 records
- **THEN** every stat tile is computed from the complete set of records,
  not an arbitrary partial slice

#### Scenario: Per-status queue tab exceeds 100 records
- **WHEN** an admin views a `/admin` status tab (e.g. "Approved") whose
  `filterByFormula` matches more than 100 records
- **THEN** `listSubmissions()` returns the complete matching set for that
  tab, and the queue list is not truncated to the first 100
