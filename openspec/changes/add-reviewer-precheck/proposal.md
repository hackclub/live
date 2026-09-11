## Why

Today, a reviewer's Approve action on `/review` writes `Approved = true` directly, which is the same flag that triggers real hour payout (via `countApprovedHours`) and the referral bonus payout. There is no separation between "a reviewer looked at this and thinks it's good" and "this project's hours are finalized and paid out." We want reviewers to be able to leave a verdict (approve/reject), a justification, and a deflated hour figure without any money moving — a human admin should make the final, payout-triggering call.

## What Changes

- Reviewers on `/review` submit a **precheck verdict** (Approve or Reject) with justification and a deflated hours figure. This writes only new `Reviewer *` fields — it never touches `Approved`, `Review Status`, or the referral payout.
- **BREAKING**: The reviewer-facing Approve/Reject buttons on `/review` no longer finalize a submission. They record a recommendation only. Any submission previously auto-approved/auto-rejected by a reviewer will instead land in the new prereviewed queue for an admin to finalize.
- `/admin` gains a new **"Prereviewed"** tab showing submissions with a recorded reviewer verdict that haven't been finalized yet (`Approved = false`, `Review Status` still empty/Pending). Each row shows the reviewer's name, justification, verdict, and suggested hours.
- The admin's hours/justification inputs prefill from the reviewer's precheck values on prereviewed rows, fully editable before the admin's own final Approve/Reject/Fraud action.
- The `fraud` action, previously reachable by any reviewer-or-admin caller, becomes **admin-only** server-side (matching the existing `ban` restriction), and the Fraud button is removed from `/review`'s queue view entirely.

## Capabilities

### New Capabilities
- `reviewer-precheck`: Reviewer verdict/justification/hours recording that is fully decoupled from approval, payout, and review-status finalization; surfaced to admins as a distinct queue.

### Modified Capabilities
(none — no existing `openspec/specs/` capability currently documents the admin/review flow)

## Impact

- `app/api/admin/review/route.ts`: new `precheck` action (reviewer-only-safe, no payout side effects); `fraud` action gated to `isAdmin`.
- `app/review/page.tsx`: Approve/Reject buttons switch to calling `precheck`; Fraud button removed from this page's queue.
- `app/admin/page.tsx`: new "Prereviewed" tab/filter alongside Pending/Approved/Rejected/Fraud.
- `app/components/admin/AdminQueue.tsx`: render reviewer verdict/justification/hours as prefill + context on prereviewed rows; hide Fraud for non-admin callers.
- `src/lib/airtable.ts`: new fields `Reviewer Verdict`, `Reviewer Justification`, `Reviewer Hours`, `Reviewer Reviewed By`, `Reviewer Reviewed At` on the Submissions table; new filter formula for the Prereviewed tab.
