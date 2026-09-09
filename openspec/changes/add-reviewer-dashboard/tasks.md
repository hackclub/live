## 1. Role foundation

- [x] 1.1 Add `isReviewerEmail()` to `src/lib/admin.ts`, parsing `REVIEWER_EMAILS` the same way as `ADMIN_EMAILS` (comma-separated, trimmed, lowercased)
- [x] 1.2 Add `REVIEWER_EMAILS=` to `.env.local` (empty by default) and note it needs to be set in Vercel env when onboarding reviewers

## 2. API route: shared auth, self-review guard, hours justification

- [x] 2.1 In `app/api/admin/review/route.ts`, broaden the auth check to `isAdminEmail(identity.primary_email) || isReviewerEmail(identity.primary_email)`
- [x] 2.2 Before applying any action (approve/reject/fraud/hours), fetch the target submission via `getSubmissionById(recordId)` and 403 if `submission.fields[SUBMISSION_FIELDS.email]` matches the caller's `identity.primary_email`
- [x] 2.3 Extend the standalone `hours` action to accept an optional `justification` in the request body and write it to `SUBMISSION_FIELDS.overrideHoursJustification` when present
- [x] 2.4 Verify `Reviewed By` / `Reviewed At` stamping is unchanged and still applied on every branch (approve/reject/fraud/hours) for both roles

## 3. Reviewer page

- [x] 3.1 Create `app/review/page.tsx` mirroring `app/admin/page.tsx`'s session/identity checks, but gating on `isAdminEmail(email) || isReviewerEmail(email)`
- [x] 3.2 Define a `REVIEW_QUEUE_FIELDS` list excluding `hackatimeId`/Telescreen-related fields (or fetch `hackatimeId` only if still needed for display minus the link — confirm against spec: no Telescreen link should render)
- [x] 3.3 Fetch submissions' `Email` field server-side (not included in the row type sent to the client) and filter out any record where it equals the caller's identity email before building rows
- [x] 3.4 Reuse the existing duplicate-code-URL detection and stats-bar logic from `app/admin/page.tsx` (avoid re-deriving separately; factor out shared helpers if easy, otherwise duplicate minimally and note the duplication)
- [x] 3.5 Do not render a link to `/admin/timer` on the reviewer page shell

## 4. Shared queue component

- [x] 4.1 Add a `showTelescreenLink` boolean prop to `AdminQueue.tsx` (default `true`), and skip rendering the Telescreen `<a>` when `false`
- [x] 4.2 Make `telescreenLink` optional on `AdminSubmissionRow` so the reviewer page can omit it entirely
- [x] 4.3 Confirm hours/justification/approve/reject/fraud controls render and behave identically for both `/admin` and `/review` usages of the component
- [x] 4.4 Render `AdminQueue` (with `showTelescreenLink={false}`) from `app/review/page.tsx`

## 5. Verification

- [ ] 5.1 Manual e2e as a reviewer-only email: confirm `/review` loads, shows non-PII fields, no Telescreen link, no timer-control link
- [ ] 5.2 Manual e2e: reviewer's own submission does not appear in their `/review` queue
- [ ] 5.3 Manual e2e: crafting a direct API request against the reviewer's own submission's `recordId` returns 403 and makes no change
- [ ] 5.4 Manual e2e: reviewer can approve, reject (with message), flag fraud, and adjust hours (with and without justification) on someone else's submission, and `Reviewed By` reflects the reviewer's real email in Airtable
- [ ] 5.5 Manual e2e: confirm existing `/admin` behavior is unchanged (Telescreen link still shows, timer link still present, all actions still work) for an admin-only email
- [ ] 5.6 Confirm an admin can also load `/review` without being redirected
- [ ] 5.7 `/opsx:archive add-reviewer-dashboard` once verified
