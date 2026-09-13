## Context

`src/lib/airtable.ts` wraps the Airtable REST API. Every list-style read hits
the same endpoint shape: a request returns up to `pageSize` (max 100) records
plus an `offset` token when more remain; the caller must re-request with that
`offset` until the response omits it. Five functions in this file already do
that correctly (`countApprovedHours`, `sumRedeemedCost`, `listAllRedemptions`,
`listRedemptionsByEmail`, `listMessagesBySubmissionIds`). `listSubmissions()`
does not — it makes one request and returns `data.records` directly. It backs
both the admin queue tabs and the full-table scan (`allRecords`) that
`app/admin/page.tsx` uses to compute every stat tile added by
`add-admin-review-stats`. Past 100 matching records, results are silently
truncated.

## Goals / Non-Goals

**Goals:**
- `listSubmissions()` returns every record matching its `filterByFormula`
  (or the whole table, when called without one), regardless of table size.
- No change to `listSubmissions()`'s signature, return type, or call sites.

**Non-Goals:**
- Fixing `getPersonalApprovedHours()` / `listSubmissionsByEmail()` (tracked
  as a follow-up in the proposal's Impact section, not part of this change).
- Changing the admin dashboard's stat-computation logic or UI.
- Adding caching, memoization, or reducing the number of Airtable calls
  `app/admin/page.tsx` makes per request — out of scope for a correctness fix.

## Decisions

- **Mirror `countApprovedHours()`'s loop shape exactly**: a `do { ... } while
  (offset)` loop accumulating into a local array, with `pageSize=100` set
  explicitly and `offset` forwarded when present. Alternative considered:
  extracting a shared `paginateAirtable()` helper used by all six functions.
  Rejected for this change to keep the diff minimal and reviewable as a
  targeted bug fix; a follow-up refactor can consolidate the duplicated loop
  once this fix is verified, but that's a larger, riskier touch of working
  code that isn't needed to resolve the reported bug.
- **No error-swallowing fallback**: unlike `countApprovedHours()` (which
  catches and returns `0` because the `Approved` field was once absent from
  the live table), `listSubmissions()` has no such legacy-field concern and
  should keep propagating errors as it does today — a silent empty result
  here would be just as misleading as the current silent truncation.

## Risks / Trade-offs

- [More Airtable API calls per admin page load once the table exceeds 100
  rows] → Acceptable: this is the same call volume `countApprovedHours()`
  and `listAllRedemptions()` already make; Airtable's rate limits (5
  req/sec/base) are well above what one admin page load needs even at a few
  hundred submissions.
- [Slightly slower `/admin` response once pagination kicks in] → Acceptable
  trade-off for correct stats; no user-facing latency requirement was set
  for this page, and it's an internal admin tool, not the public dashboard.

## Migration Plan

No data migration. Deploy is a single-function code change with no schema or
env var impact. Rollback is a plain revert if needed.
