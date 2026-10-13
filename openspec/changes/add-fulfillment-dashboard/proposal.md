# Proposal

## Why

Fulfillment is currently done by hand in Airtable: an admin scans the flat Redemptions table, cross-references each buyer's approved hours, and stamps `Fulfilled At` / `Fulfilled By` manually. There is no way to see, per user, what's still owed, whether their spending is backed by projects already in the Unified YSWS database (which is what funds us), or whether they spent more hours than they ever earned. With 389 redemptions across 61 users, 186 still unfulfilled, and a few users already overspent, we need one admin view that makes fulfillment fast and makes risk and budget visible before we pay anything out.

## What Changes

- **BREAKING (admin UI):** `/admin/purchases` is replaced by a per-user fulfillment dashboard. The flat purchases table and its existing stats/funding block go away; refund, refund-all, referral links and the snapshot feature are kept.
- Redemptions are grouped per user (normalized email). Identical items (same name and cost) collapse into one `×N` line showing hours and USD at the payout rate.
- Admins can mark a line (single row or a whole `×N` group) as fulfilled or unfulfilled. This writes or clears the existing Airtable `Fulfilled At` / `Fulfilled By` fields. `Status`, `Assignee` and `Notes` stay untouched.
- New read-only integration with the Unified YSWS "Approved Projects" table (separate base and PAT via `UNIFIED_PAT`, `UNIFIED_APP_NAME`, `UNIFIED_TABLE_NAME`), filtered to the Live YSWS.
- Each user's approved local projects are matched to Unified by Code URL and badged "in Unified" or "local only".
- Each user is classified: **EXPLOIT** (spent more than their locally approved hours, by any amount), **OVERAGE** (spent more than their Unified hours but no more than local), or **OK**. A dedicated exploit list is shown at the top.
- Finance header uses two rates: revenue = Unified hours × $8.50 (existing `HOUR_VALUE_USD`, unchanged); payout = $5.00/hr (new constant). Shows HCB balance, unfulfilled payout, the headline **HCB − unfulfilled** (assuming we self-fund overage), plus informational revenue-earned, pending-revenue, overage-exposure and exploit-exposure figures.
- The snapshot panel shows direct links per project: code URL, playable URL, and the Unified record when matched.

## Capabilities

### New Capabilities
- `purchase-fulfillment`: Admin per-user view of redemptions, grouped by item, with the ability to mark items fulfilled or unfulfilled via the Redemptions table's fulfillment fields.
- `redeemer-spend-audit`: Matching each redeemer's approved projects against the Unified YSWS database and classifying their spending as OK / OVERAGE / EXPLOIT, including per-project links in the snapshot.
- `fulfillment-finances`: The admin budget summary: HCB balance against unfulfilled payouts at the payout rate, with revenue, overage and exploit exposure.

### Modified Capabilities
(none — no archived spec covers `/admin/purchases`. The unarchived `add-admin-purchases-referrals-dashboards` change's `admin-purchases-dashboard` layout is superseded by this change, and `purchase-refunds` behavior is kept as-is.)

## Impact

- **Pages:** `app/admin/purchases/page.tsx` rewritten; `app/components/admin/PurchasesTable.tsx` replaced by per-user fulfillment components; `RefundAllPanel` reused.
- **APIs:** new admin-only `POST /api/admin/purchases/fulfill`. `GET /api/admin/purchases/snapshot` extended to return project links and Unified match status. Refund routes unchanged.
- **Libraries:** `src/lib/airtable.ts` gets fulfillment field constants, a batch update for Redemptions, and an all-approved-submissions read. New `src/lib/unified-airtable.ts` for the Unified base. `src/lib/hcb.ts` gets `PAYOUT_USD_PER_HOUR = 5` (`HOUR_VALUE_USD` stays 8.5).
- **Config:** `UNIFIED_PAT`, `UNIFIED_APP_NAME`, `UNIFIED_TABLE_NAME` must be set locally and on Vercel. The Unified PAT needs read access to that base only.
- **Airtable:** no schema changes. Uses existing `Fulfilled At` (dateTime) and `Fulfilled By` (text) on Redemptions.
- **Rate limits:** adds Unified reads on page load (≈2 paged requests); these are cached and throttled separately from the Live base.
