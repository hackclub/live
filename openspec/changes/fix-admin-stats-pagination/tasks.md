## 1. Fix pagination

- [x] 1.1 In `src/lib/airtable.ts`, rewrite `listSubmissions()` to accumulate
      records across requests using the same `do { ... } while (offset)`
      shape as `countApprovedHours()`, setting `pageSize=100` and forwarding
      `offset` on each subsequent request, until a response has no `offset`.
- [x] 1.2 Keep the function's signature (`filterByFormula?: string, fields?:
      string[]`) and return type (`Promise<AirtableRecord[]>`) unchanged so
      no caller needs to change.
- [x] 1.3 Preserve existing error behavior — do not add a try/catch or
      fallback-to-empty; requests should still throw on failure exactly as
      today.

## 2. Verification

- [x] 2.1 Confirm both `/admin` call sites (`listSubmissions(filterFormula(status),
      QUEUE_FIELDS)` for the queue tab and `listSubmissions(undefined,
      DUPLICATE_CHECK_FIELDS)` for `allRecords`) still compile and run
      unchanged against the new implementation.
- [ ] 2.2 Manually load `/admin` against the live base (which now has more
      than 100 submissions) and confirm `approvedHours`, `approvedProjects`,
      `rejectedHours`, `rejectedProjects`, `fraudHours`, `fraudProjects`,
      `queueCount`, `remainingToReview`, and `percentApproved` match a manual
      count/sum from Airtable directly — this was the unchecked verification
      step from `add-admin-review-stats` that let the original bug ship.
- [ ] 2.3 Verify a status tab with more than 100 matching records (e.g.
      "Approved") now lists all of them, not just 100.
- [ ] 2.4 Verify a status tab with 100 or fewer records still loads
      correctly (no regression/extra empty request) and behaves identically
      to before this change.
