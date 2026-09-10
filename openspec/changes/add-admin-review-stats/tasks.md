## 1. Stat computation

- [x] 1.1 In `app/admin/page.tsx`, extend the existing `for (const record of allRecords)` loop with counters: `approvedHours`, `approvedProjects`, `rejectedHours`, `rejectedProjects`, `fraudHours`, `fraudProjects`, `unreviewedHours`.
- [x] 1.2 Implement the `unreviewed` predicate as `!approved && (reviewStatus === 'Pending' || reviewStatus === '') && !justification` (read `SUBMISSION_FIELDS.overrideHoursJustification`), and accumulate `unreviewedHours` alongside the existing `unreviewedCount`.
- [x] 1.3 Compute `percentApproved = reviewedTotal === 0 ? null : approvedProjects / reviewedTotal` where `reviewedTotal = approvedProjects + rejectedProjects + fraudProjects`.
- [x] 1.4 Compute progress values: `reviewedTotal`, `remaining = queueCount - reviewedTotal`.

## 2. Dashboard UI

- [x] 2.1 Remove the existing undifferentiated "Total hours" stat tile.
- [x] 2.2 Add stat tiles for Approved hours/projects, Rejected hours/projects, Fraud hours/projects, and Unreviewed hours (keep existing Unreviewed count tile).
- [x] 2.3 Add a percent-approved tile that renders "—" when `percentApproved` is `null`, otherwise a rounded percentage.
- [x] 2.4 Add a progress bar (e.g. `progress` element or styled div) showing `reviewedTotal`/`queueCount` fill, with a label like "N more to review".

## 3. Verification

- [ ] 3.1 Manually load `/admin` with a mix of pending/approved/rejected/fraud submissions and confirm each new tile's number against a manual count from the Airtable base.
- [ ] 3.2 Verify percent-approved shows "—" (not `NaN`/`Infinity`) when no submissions have been reviewed yet.
- [ ] 3.3 Verify the progress bar and "more to review" label update correctly as records move between statuses.
