## 1. Airtable schema

- [ ] 1.1 Add `Reviewer Verdict` (single select: Approve/Reject), `Reviewer Justification` (long text), `Reviewer Hours` (number), `Reviewer Reviewed By` (text/email), `Reviewer Reviewed At` (date/ISO text) fields to the Submissions table.
- [x] 1.2 Add the new field name constants to `SUBMISSION_FIELDS` in `src/lib/airtable.ts`.

## 2. API route: precheck action + fraud gating

- [x] 2.1 Add `precheck` to the `ACTIONS` tuple in `app/api/admin/review/route.ts`.
- [x] 2.2 Implement the `precheck` branch: validate `verdict` is `"approve"`/`"reject"`, validate hours (same `Number.isFinite && >= 0` check as `hours`/`approve`), require justification, write only `Reviewer Verdict`, `Reviewer Justification`, `Reviewer Hours`, `Reviewer Reviewed By`, `Reviewer Reviewed At` via `updateAirtableRecord`.
- [x] 2.3 Keep the existing self-review check (`cannot_review_own_submission`) applying to `precheck` as well.
- [x] 2.4 Gate the existing `fraud` branch to `isAdmin` only (mirror the `ban` admin-only check), returning `403 forbidden` for non-admins.
- [x] 2.5 Confirm `precheck` never reaches the `payReferral` call or sets `Approved`/`Review Status`.

## 3. `/review` page and queue UI

- [x] 3.1 Update `app/review/page.tsx` filter formula so precheck'd rows drop out of the reviewer's own Pending tab instead of lingering for a redundant second precheck.
- [x] 3.2 Add an `allowFraud` (or equivalent) prop to `AdminQueue`; default `true` for `/admin`, pass `false` from `/review` to hide the Fraud button.
- [x] 3.3 Add a precheck mode to `AdminQueue` (or a variant) so `/review`'s Approve/Reject buttons call the new `precheck` action with `{verdict, justification, hours}` instead of `approve`/`reject`.
- [x] 3.4 Relabel `/review`'s buttons (e.g. "Recommend Approve" / "Recommend Reject") and add a short inline note that hours/payout are finalized by an admin.

## 4. `/admin` Prereviewed tab

- [x] 4.1 Add `"Prereviewed"` to the tab list in `app/admin/page.tsx` (and `AdminQueue`'s `FILTERS`, or a parallel prop) with filter formula: `Reviewer Verdict` is set AND `Approved = FALSE()` AND (`Review Status` = 'Pending' OR `Review Status` = '').
- [x] 4.2 Fetch the new `Reviewer *` fields in `/admin`'s `QUEUE_FIELDS` and include them on `AdminSubmissionRow`.
- [x] 4.3 Render reviewer name/justification/verdict/suggested hours as read-only context on prereviewed rows in `AdminQueue`.
- [x] 4.4 Initialize `hoursDraft`/`justificationDraft` state for a row from `Reviewer Hours`/`Reviewer Justification` when present, falling back to current behavior otherwise; keep them fully editable.
- [x] 4.5 Verify a row leaves the Prereviewed tab once the admin's Approve/Reject/Fraud action finalizes it (no extra state needed since the filter is derived).

## 5. Verification

- [ ] 5.1 Manual e2e: reviewer prechecks approve with justification + deflated hours → confirm `Approved` stays false, no timer/referral change, row appears in `/admin` Prereviewed.
- [ ] 5.2 Manual e2e: reviewer prechecks reject → confirm `Review Status` unchanged, row appears in `/admin` Prereviewed (not auto-rejected).
- [ ] 5.3 Manual e2e: admin opens a prereviewed row, edits the prefilled hours, clicks Approve → confirm final `Override Hours` reflects the admin's edit, `Approved=true`, payout/timer/referral fire as before.
- [ ] 5.4 Manual e2e: reviewer attempts fraud via API directly (bypassing UI) → confirm `403 forbidden`.
- [ ] 5.5 Confirm `/review`'s queue no longer renders a Fraud button for reviewer or admin identities.
