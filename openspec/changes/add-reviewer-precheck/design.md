## Context

`/review` and `/admin` both render `AdminQueue` (`app/components/admin/AdminQueue.tsx`), fed by near-identical page logic in `app/review/page.tsx` and `app/admin/page.tsx`, and both post to the single `POST /api/admin/review` route. That route's `approve`/`reject`/`fraud` actions all write directly to the submission's final fields:

- `Approved` (boolean) — read by `countApprovedHours()` (stream timer) and by `payReferral()` (referral bonus). Setting it true is what actually pays out.
- `Review Status` (`Pending` / `Rejected` / `Fraud`) — terminal status for non-approved outcomes.
- `Override Hours` / `Override Hours Justification` — the final hour figure and reviewer's/admin's note.
- `Reviewed By` / `Reviewed At` — who/when made the final call.

Reviewer (`isReviewerEmail`) and admin (`isAdminEmail`) are already distinct allowlists (`src/lib/admin.ts`), and `ban` is already gated admin-only in the route — `fraud` is not, which is a gap this change closes.

## Goals / Non-Goals

**Goals:**
- Let a reviewer record a verdict (approve/reject), justification, and deflated hours with zero side effects on payout, timer totals, or referral payout.
- Give admins a dedicated queue of reviewer-prechecked submissions, with the reviewer's inputs visible and prefilled, before the admin's own action finalizes anything.
- Close the existing gap where any reviewer can call the `fraud` action.

**Non-Goals:**
- No change to the admin's own approve/reject/fraud/ban semantics — an admin still directly finalizes exactly as today (`Approved=true`, `Review Status`, payout, referral trigger) when acting from the Prereviewed tab or anywhere else.
- No change to how `countApprovedHours`, the stream timer, or referral payout are computed — they keep reading only the existing final fields.
- Not building a full multi-stage workflow engine — this is one additional non-terminal state, not a generic pipeline.

## Decisions

**New fields instead of reusing `Override Hours` / `Override Hours Justification` / `Reviewed By/At`.** A reviewer's precheck must never be mistaken for the final admin figure, and an admin must be able to see both the reviewer's suggestion and their own edited value distinctly while deciding. Reusing the existing fields would either clobber them before the admin acts, or require an extra "is this finalized yet" bit layered on top of fields whose entire purpose today is "the final answer." New fields: `Reviewer Verdict` (Approve/Reject), `Reviewer Justification`, `Reviewer Hours`, `Reviewer Reviewed By`, `Reviewer Reviewed At`.

**New `precheck` action on the existing route, not a new route.** `POST /api/admin/review` already resolves identity, role, and the "can't review your own submission" check once; a new action fits the existing dispatch (`ACTIONS = [...]`) rather than duplicating that logic in a second endpoint. `precheck` accepts `{recordId, verdict: "approve"|"reject", justification, hours}` and writes only the five `Reviewer *` fields — never `Approved` or `Review Status`.

**Prereviewed is a queue filter, not a new terminal `Review Status` value.** A submission is "prereviewed" purely by having `Reviewer Verdict` set while `Approved=false` and `Review Status` is still empty/Pending. This means an admin's eventual Approve/Reject/Fraud action naturally moves it out of the Prereviewed filter with no extra bookkeeping — the existing filterFormula pattern in both pages already computes tabs this way (see `filterFormula` in `app/review/page.tsx` / equivalent in `app/admin/page.tsx`).

**`/review` calls `precheck` for both its Approve and Reject buttons; `fraud` gated server-side to `isAdmin`, Fraud button removed from `/review`'s render of `AdminQueue`.** `AdminQueue` already takes a `showTelescreenLink` prop to vary rendering per page; the same pattern (a new prop, e.g. `allowFraud`) hides the Fraud button on `/review` without forking the component. Server-side gating is the actual security boundary; the UI change is just to not offer an action that would be rejected anyway.

**Admin's hours/justification inputs prefill from `Reviewer Hours`/`Reviewer Justification` when present, fully editable.** `AdminQueue`'s existing `hoursDraft`/`justificationDraft` local state already initializes per-row from `row.hours`; on a prereviewed row it initializes from the reviewer's suggested values instead, with no read-only mode — the admin's own state update on change works unchanged.

## Risks / Trade-offs

- **Reviewer misreads their action as final.** The current Approve/Reject buttons already exist and reviewers are used to them being final. → Relabel the buttons on `/review` (e.g. "Recommend Approve" / "Recommend Reject") and add a short inline note that an admin will finalize hours/payout.
- **A submission gets prechecked twice by different reviewers, second overwrites first.** `Reviewer *` fields are a single set, not a list — a second reviewer's precheck silently replaces the first's. → Out of scope for this change (mirrors today's single-slot `Reviewed By/At` behavior); if this becomes a real problem, a future change can add a lock or history.
- **Existing reviewer muscle memory relies on Approve being final (payout).** No submissions are silently un-paid — this only changes future actions; nothing already `Approved=true` is affected.

## Migration Plan

- Add the five new fields to the Airtable Submissions table (manual step, not code) before deploying: `Reviewer Verdict`, `Reviewer Justification`, `Reviewer Hours`, `Reviewer Reviewed By`, `Reviewer Reviewed At`.
- Ship route + UI changes together; the `precheck` action is additive (new `ACTIONS` entry) and `fraud`'s gating is a straightforward permission tightening with no data migration.
- No backfill needed — existing `Approved`/`Review Status` rows are unaffected; the Prereviewed filter simply returns nothing until reviewers start using the new flow.

## Open Questions

- None outstanding — button copy ("Recommend Approve/Reject") is a reasonable default the user can adjust in review.
