## Why

Right now the only way to help review submissions is to grant full `/admin` access, which exposes operational controls (timer control) and a Telescreen link that isn't needed to judge a submission on its merits. We need a lower-trust role that can review submissions (approve, reject, flag fraud, adjust hours with justification) without those extra powers, while every action they take is still attributable to their real email before it reaches Airtable — and without letting anyone review their own submission.

## What Changes

- Add a `REVIEWER_EMAILS` env-based allowlist (mirrors the existing `ADMIN_EMAILS` pattern) and an `isReviewerEmail()` check in `src/lib/admin.ts`.
- Add a new `/review` page that reuses the admin queue's non-PII fields (screenshot, code URL, playable URL, lapse links, hackatime project, description) but drops the Telescreen link and any link to timer control.
- Reviewers can take the same four review actions as admins today: approve, reject, flag fraud, and adjust hours — via the existing `/api/admin/review` endpoint, now authorized for `isAdminEmail() || isReviewerEmail()`.
- Server-side self-review guard: `/api/admin/review` fetches the target submission's `Email` field and rejects (403) any action where it matches the caller's identity email, for both admins and reviewers. The `/review` queue also filters out the reviewer's own submission so it's never shown.
- **BREAKING (internal only)**: the standalone `hours` action on `/api/admin/review` now also accepts and writes `SUBMISSION_FIELDS.overrideHoursJustification`, closing a gap where hours-only adjustments never recorded a justification (previously only the approve-with-hours path did). This changes existing admin behavior, not just reviewer behavior.
- `Reviewed By` / `Reviewed At` stamping is unchanged — it already writes the caller's real `identity.primary_email` on every write, so this requirement is inherited for free by reviewers.

## Capabilities

### New Capabilities
- `reviewer-access`: A restricted reviewer role — email-allowlist gating, a scoped `/review` queue (non-PII fields only, no Telescreen link, no timer control), self-review prevention, and shared use of the existing review-action endpoint (approve/reject/fraud/hours with justification), with every write attributed to the reviewer's real email.

### Modified Capabilities
- None. No existing `specs/` capability currently documents `/admin` or `/api/admin/review` behavior, so there is no delta spec to write against — the hours-justification fix and self-review guard are captured as part of the new `reviewer-access` spec since they're a required precondition for reviewers to use those actions safely.

## Impact

- `src/lib/admin.ts`: add `isReviewerEmail()`.
- `app/review/page.tsx` (new), `app/components/review/ReviewQueue.tsx` (new, forked/parameterized from `AdminQueue.tsx`).
- `app/api/admin/review/route.ts`: broaden auth check, add self-review guard, extend `hours` action to write justification.
- `.env.local` / Vercel env: new `REVIEWER_EMAILS` variable.
- No Airtable schema changes — reuses existing `Reviewed By`, `Reviewed At`, and `Override Hours Justification` fields.
