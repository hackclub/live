## Context

`/admin` (`app/admin/page.tsx`) is currently the only UI for reviewing submissions. It's gated by `isAdminEmail()` (`src/lib/admin.ts`, `ADMIN_EMAILS` env allowlist) and posts actions to `POST /api/admin/review` (`app/api/admin/review/route.ts`), which supports `approve | reject | fraud | hours` and stamps `Reviewed By` / `Reviewed At` with the caller's real email on every write.

The admin queue already avoids PII at the query level — `QUEUE_FIELDS` in `app/admin/page.tsx` never fetches Name/Email/Address/Birthday — but it does fetch `hackatimeId` and builds a Telescreen link from it, and the page links to `/admin/timer`. Neither of those belongs in a reviewer's scope.

We're adding a second, lower-trust role (`REVIEWER_EMAILS`) that gets a `/review` page with the same non-PII fields and the same four review actions, minus Telescreen/timer access, plus a hard block on reviewing one's own submission.

## Goals / Non-Goals

**Goals:**
- Reviewers can approve, reject, flag fraud, and adjust hours (with justification) through the existing `/api/admin/review` endpoint.
- Reviewers never see a Telescreen link, timer control, or any PII field.
- Reviewers cannot act on their own submission — enforced server-side, not just hidden in the UI.
- Every write is attributed to the real caller email via the existing `Reviewed By` mechanism (no new field needed).
- Role membership lives in code (env var), matching the existing `ADMIN_EMAILS` pattern — no new Airtable table.

**Non-Goals:**
- No new Airtable schema/fields. Reuses `Reviewed By`, `Reviewed At`, `Override Hours Justification`.
- No granular per-action permissions between admin and reviewer (e.g. reviewer can't approve-but-not-fraud) — both roles get the same four actions on this endpoint. Differentiation is entirely about *what they can see*, not *which actions they can invoke*.
- No audit/history UI for who-reviewed-what beyond the existing `Reviewed By`/`Reviewed At` fields.
- No changes to `/admin/timer` or timer control permissions.

## Decisions

**1. Single shared API route, broadened auth check, rather than a separate `/api/review/review` route.**
`/api/admin/review` already contains all the action logic (approve/reject/fraud/hours + messaging + referral payout on approve). Forking it into a parallel route would duplicate that logic and risk drift (e.g. referral payout only wired into one copy). Instead, broaden the existing auth check from `isAdminEmail(email)` to `isAdminEmail(email) || isReviewerEmail(email)`, and add the self-review guard inside it so it applies uniformly to both roles.
- Alternative considered: a dedicated `/api/reviewer/review` route with a stripped-down action set. Rejected — there's no action-set difference between the roles per this change's scope, so the duplication would buy nothing.

**2. Self-review guard lives in the API route, not just the queue filter.**
The `/review` page filters out the reviewer's own submission at query time (defense-in-depth, and a better UX — they never see it listed). But the API route independently re-fetches the target submission's `Email` field via `getSubmissionById` and 403s if it matches the caller's identity email. This matters because the route takes a client-supplied `recordId` — a client-side filter alone would not stop a reviewer from crafting a request against their own record's ID.
- Applies to all four actions (approve/reject/fraud/hours), not just approve.
- Applies to admins too, for consistency, even though staff self-submission is presumed rare/moot.

**3. `ReviewQueue` is `AdminQueue` parameterized, not a separate component.**
`AdminQueue.tsx` is ~180 lines of shared state/markup (drafts, `act()` fetcher, buttons, messages thread). The only reviewer-specific differences are: no Telescreen `<a>`, and the page shell doesn't link to timer control. Rather than fork the file, add two boolean props (e.g. `showTelescreenLink`, defaulting `true` for `/admin`'s usage, `false` for `/review`'s) to the existing component and drop the telescreen field from `AdminSubmissionRow` when not needed. The timer-control link lives in the page shell (`app/admin/page.tsx` vs `app/review/page.tsx`), not the shared component, so no prop is needed for that.
- Alternative considered: forking to `ReviewQueue.tsx`. Rejected — the two would drift on every future admin-queue change (e.g. the recent duplicate-Code-URL detection, stats bar) unless both were updated in lockstep every time.

**4. `hours` action gains justification support for both roles, as a prerequisite fix.**
The standalone `hours` action currently only writes `overrideHours` + `Reviewed By/At` — never `Override Hours Justification` — unlike the approve-with-hours path. Since reviewers get standalone hours access and need justification support there, fix this gap for both roles rather than giving reviewers a justification-capable hours path that diverges from what admins have. This is a small, backward-compatible additive change (new optional field write) to existing route logic.

**5. Role check via two independent allowlists, not a merged role map.**
`REVIEWER_EMAILS` is a new, separate env var parsed the same way as `ADMIN_EMAILS` (comma-separated, lowercased, trimmed) rather than refactoring both into a single `{email: role}` structure. Keeps the change additive and low-risk; an admin email does not need to also appear in `REVIEWER_EMAILS` since `/api/admin/review`'s auth check is an OR of both allowlists, and `/review`'s page gate should also accept admins (an admin should not be locked out of `/review` if they want to use the lighter-weight view).
- Alternative considered: unifying into a role map now. Rejected as unnecessary scope for this change; can revisit if a third role appears.

## Risks / Trade-offs

- **[Risk]** Adding an extra `getSubmissionById` fetch on every action call adds one more Airtable round-trip to a write path. → **Mitigation**: this data is small (single record by ID) and the endpoint already does a similar fetch on the approve path for referral payout; acceptable latency cost for the security guarantee.
- **[Risk]** Parameterizing `AdminQueue` risks the reviewer view accidentally inheriting a future PII-adjacent field if someone extends `AdminSubmissionRow` without checking reviewer scope. → **Mitigation**: keep `QUEUE_FIELDS` construction explicit per page (admin vs review each define their own field list), so a new field added to one doesn't silently leak into the other; the shared component should never assume all rows have all fields.
- **[Risk]** Making `hours` action write justification changes existing admin behavior (arguably a scope-creep beyond "add reviewer role"). → **Mitigation**: flagged explicitly in the proposal as an internal behavior change bundled in because it's a hard prerequisite for reviewer parity; it's additive (new optional write) and doesn't change any existing read/response shape.
- **[Trade-off]** Reviewers and admins share identical action power on this endpoint (no fraud/hours restriction for reviewers). Accepted per explicit product decision — reviewers are meant to fully review, just without operational/PII access.

## Migration Plan

1. Add `REVIEWER_EMAILS` to `.env.local` (empty/unset is safe — no reviewers until populated) and document it for Vercel env.
2. Ship `isReviewerEmail()`, the route auth/self-review changes, and the `hours` justification fix together (route changes are additive, no breaking response shape).
3. Ship `/review` page + parameterized `AdminQueue`.
4. Populate `REVIEWER_EMAILS` in Vercel env when ready to onboard actual reviewers.
5. Rollback: revert the route/page changes; `REVIEWER_EMAILS` being unset makes `isReviewerEmail()` always return false, so no rollback data migration is needed.

## Open Questions

- None outstanding — role scope, self-review handling, and the hours-justification fix were confirmed during exploration.
