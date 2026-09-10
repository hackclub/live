## Context

`app/admin/page.tsx` already does a single unfiltered scan of `allRecords` (all Submission records, any status) to compute duplicate-code-URL groups, `unreviewedCount`, and `totalHours`. This change extends that same loop rather than adding new fetches, so it stays a pure display/computation change.

Field reference (`src/lib/airtable.ts`):
- `SUBMISSION_FIELDS.approved` — boolean, source of truth for "counts as approved" (independent of `reviewStatus` string).
- `SUBMISSION_FIELDS.reviewStatus` — `'Pending' | 'Approved' | 'Rejected' | 'Fraud' | ''`.
- `SUBMISSION_FIELDS.overrideHours` — number, the hours value summed for every stat.
- `SUBMISSION_FIELDS.overrideHoursJustification` — string, written by the admin as part of any review action.

## Goals / Non-Goals

**Goals:**
- Show admins per-status hours and project counts (fraud, rejected, approved) plus percent-approved and a review-progress bar, on the same page load, with no additional Airtable requests.
- Tighten "unreviewed hours" so it can't double-count a reviewed record with a missing justification.

**Non-Goals:**
- No changes to the review action flow (`/api/admin/review`), Airtable schema, or how justifications get written.
- No historical/time-series stats (e.g. hours-per-day) — this is a point-in-time snapshot on page load, same as today.
- No changes to the `AdminQueue` table rows themselves — this only touches the stats bar above it.

## Decisions

**One combined counter loop, not separate `.filter().reduce()` passes.**
`allRecords` is already iterated once for duplicate-group detection. Adding `if/else` branches to that same `for` loop keeps this O(n) with one pass instead of six separate array scans. Alternative considered: derive each stat with its own `.filter(...).length` / `.reduce(...)` — simpler to read but redundant work and easy to have the predicates drift out of sync with each other.

**`unreviewed` predicate requires reviewStatus in addition to approved+justification.**
Per proposal: `approved === false && reviewStatus in ('Pending','') && !justification`. Adding the `reviewStatus` check (over the simpler `approved===false && !justification`) prevents a Fraud/Rejected record that's missing its justification from being counted as both frauded/rejected *and* unreviewed.

**Percent approved excludes pending submissions from the denominator.**
`approvedProjects / (approvedProjects + rejectedProjects + fraudProjects)`, not `/ queueCount`. This reflects review quality/accuracy independent of backlog size — a growing pending pile shouldn't make the approval rate look like it's dropping.

**Progress bar reuses `queueCount` as its total.**
`reviewed = approvedProjects + rejectedProjects + fraudProjects`; `remaining = queueCount - reviewed`; fill = `reviewed / queueCount`. No new "total" concept introduced — it's the same `allRecords.length` already computed.

**Replace the old "Total hours" tile rather than keep it alongside the new ones.**
An undifferentiated sum across every status is strictly less useful once fraud/rejected/approved hours are broken out individually, and keeping it risks admins mistaking it for one of the new per-status numbers. `unreviewedCount` (project count) stays as-is.

## Risks / Trade-offs

- **[Risk]** If a submission is reviewed (Approved/Rejected/Fraud) but the justification write failed partway, it's excluded from `unreviewed` (correct, since reviewStatus check now guards it) but its hours also won't show up as approved/rejected/fraud unless reviewStatus was actually persisted — i.e. a record can still fall through all buckets if `reviewStatus` itself never got written. → Mitigation: none needed for this change; that's a pre-existing data-integrity concern in the review-write path, not something the stats display should paper over.
- **[Trade-off]** Percent-approved with a zero denominator (no submissions reviewed yet) must render as something other than `NaN`/`Infinity` — display as `—` or `0%` when `approvedProjects + rejectedProjects + fraudProjects === 0`.

## Migration Plan

Purely additive UI change behind existing auth-gated `/admin` route. No data migration, no feature flag needed — ships as a normal deploy. Rollback is a plain revert of `app/admin/page.tsx`.

## Open Questions

None outstanding — denominator choices for percent-approved and the unreviewed-hours predicate were confirmed during exploration.
