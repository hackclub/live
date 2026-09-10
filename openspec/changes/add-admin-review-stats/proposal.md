## Why

The `/admin` review queue currently shows only an undifferentiated hours total, an unreviewed count, and a raw "in queue" record count. Admins reviewing submissions have no visibility into how much of that volume is fraud, how much is being rejected, how their approval rate is trending, or how much of the backlog they've actually worked through in the current session.

## What Changes

- Replace the single "Total hours" stat tile with per-status hour totals: **fraud hours**, **rejected hours**, **approved hours**.
- Add per-status project counts: **fraud projects**, **rejected projects**, **approved projects**.
- Redefine "unreviewed hours" to require all three: `Approved = FALSE`, `Review Status` is `Pending`/empty, and `Optional - Override Hours Spent Justification` is empty — guards against double-counting a reviewed record that's missing a justification.
- Add a **percent approved** stat: `approved / (approved + rejected + fraud)` (excludes still-pending submissions from the denominator).
- Add a **review progress bar**: reviewed (`approved + rejected + fraud`) out of `queueCount`, with a "N more to review" label.

## Capabilities

### New Capabilities
- `admin-review-stats`: Computing and displaying per-status hour/project totals, percent-approved, and review progress on the `/admin` dashboard.

### Modified Capabilities
(none — no existing spec covers the admin review queue)

## Impact

- `app/admin/page.tsx`: extend the existing single-pass loop over `allRecords` with additional counters; no new Airtable calls.
- Uses existing fields only: `SUBMISSION_FIELDS.approved`, `.reviewStatus`, `.overrideHours`, `.overrideHoursJustification` (`src/lib/airtable.ts`).
- Purely additive/display change — no API routes, no Airtable schema changes, no data writes.
