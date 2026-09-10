## Context

`/admin/purchases` (`app/admin/purchases/page.tsx`) renders every Redemptions record via `listAllRedemptions()`, split by `PurchasesTable` into direct purchases (`cost > 0`) and referral payouts (`cost === 0`, linked to a `Referrals` row via `REFERRAL_FIELDS.redemption`). Token balance (`getTokenBalance` in `src/lib/airtable.ts`) is computed live as approved hours minus `sumRedeemedCost()` — there is no stored balance to reconcile.

`deleteAirtableRecord` already exists in `src/lib/airtable.ts` but is bound to `submissionTableConfig()` (the Submissions table), used today only for deleting submissions. It cannot be pointed at Redemptions without changes.

The admin review route (`app/api/admin/review/route.ts`) establishes the auth pattern this reuses: `getSessionFromRequest` → `getIdentity` → email-based role check, plus a self-action guard (`cannot_review_own_submission`) re-checked server-side against the record's stored email, not the client's claim.

## Goals / Non-Goals

**Goals:**
- Let an admin permanently refund a direct purchase (cost > 0) from `/admin/purchases`, restoring the redeemer's token balance.
- Enforce admin-only access and block an admin from refunding their own redemption.
- Never expose a refund action for referral-payout rows.

**Non-Goals:**
- Refunding or unwinding referral payouts (`cost === 0` rows) — explicitly out of scope per product decision.
- Any reversal/undo of the refund itself (no "restore" — deletion is final, matching the existing Airtable-delete-is-final pattern used for submissions).
- Audit/history table for refunds — a server-side log line is sufficient, matching the existing `[referral] payout...` logging style.
- Partial refunds or refunding an amount different from the original cost.

## Decisions

- **Delete, don't soft-mark.** The proposal's ask is literally "delete that entry in the Airtable row," and since balance is computed live from `sumRedeemedCost()`, deleting the row is sufficient to restore hours — no extra bookkeeping field needed. Alternative considered: adding a `Refunded` flag and filtering it out of `sumRedeemedCost`/`listAllRedemptions` — rejected as unnecessary complexity for a feature whose only requirement is "give the hours back."
- **New `deleteRedemptionRecord` helper, scoped to `redemptionsTableConfig()`.** Reusing `deleteAirtableRecord` by parameterizing its table config was considered, but every other Airtable helper in this file already follows the pattern of one function per table per operation (`updateAirtableRecord` is submissions-only, `createRedemption` is redemptions-only, etc.) — a new dedicated function matches existing conventions better than adding a table-config parameter to a shared one.
- **Admin-only, not reviewer.** `/admin/purchases` (the page) already gates on `isAdminEmail` only, unlike the review queue which allows both admins and reviewers. The refund API mirrors the page's existing gate rather than the review route's broader one.
- **Self-refund block via server-side email comparison.** Same shape as `cannot_review_own_submission`: look up the Redemptions record server-side by `recordId`, compare its stored `Email` field to the caller's identity email (case-insensitive), reject with 403 if they match. The client can't be trusted to omit the button for its own rows (a self-serving admin could otherwise call the API directly).
- **Referral-payout rows are inert, not merely hidden.** The API route itself rejects any `recordId` whose `cost === 0` (checked server-side against the fetched record, not client-supplied), in addition to the button never rendering for such rows in `PurchasesTable`. Belt-and-suspenders against a crafted request.
- **Client-side confirm before the destructive call.** A native `confirm()` (matching the codebase's existing lack of a modal library) prevents accidental clicks on an unrecoverable delete.
- **Optimistic row removal after success**, no full page reload — consistent with `PurchasesTable`'s existing client-side `expanded` state pattern; the row is spliced out of local state and the stats header (`Total redemptions`, `Total hours spent`, etc. computed server-side in `page.tsx`) will reflect correctly on next navigation/refresh.

## Risks / Trade-offs

- [Deletion is unrecoverable — a mis-click permanently destroys the audit trail of a purchase] → Mitigated by client-side confirm dialog and admin-only gating; accepted per explicit product ask ("as simple as just deleting that entry").
- [No server-side audit log beyond a console line] → Acceptable for now, matching the existing referral-payout logging bar; can be revisited if refund volume/disputes warrant a persisted log later.
- [Optimistic client-side removal could drift from server state if the delete silently fails] → Mitigated by only removing the row after a successful (2xx) API response, and showing an inline error otherwise (no removal on failure).

## Migration Plan

No data migration. This is additive: a new API route, a new Airtable helper function, and a new button in an existing client component. No env vars, no schema changes. Deploys like any other route addition.

## Open Questions

None outstanding — scope was clarified directly by the requester (admin-only, direct purchases only, no self-refund).
