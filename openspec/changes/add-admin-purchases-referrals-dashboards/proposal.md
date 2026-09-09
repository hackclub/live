## Why

Admins currently have no way to see what prizes people are redeeming or how the referral program is performing — that data only exists as raw Airtable rows. Admins want visibility into purchases and referrals without exposing anyone's email or address, and want purchase rows to show the approved-submission history that got the redeemer to the balance they spent.

## What Changes

- Add `/admin/purchases`: a table of all redemptions (row id, redeemer first name + GitHub handle, item, cost, redeemed date), each row expandable to a **balance snapshot** — every submission approved before that `redeemedAt`, summed to the hours-at-that-moment. No email, address, or birthday shown anywhere on this page.
- Add `/admin/referrals`: a table of all referral relationships (row id, referrer + referee shown as first name + GitHub handle, status: pending/paid/void).
- Stat bar on `/admin/purchases`: total redemptions, direct-purchase count (`cost > 0`) vs referral-payout count (`cost === 0`), total hours spent.
- Stat bar on `/admin/referrals`: total referrals, paid vs pending vs void, hours generated via referral payouts.
- Cross-linking: a paid-out referral row links to its corresponding `cost: 0` redemption row on `/admin/purchases`; a `cost: 0` redemption row links back to the referral relationship that generated it.
- Both routes gated the same way as existing `/admin` pages (admin-only session check).

## Capabilities

### New Capabilities
- `admin-purchases-dashboard`: admin-only view of all redemptions with per-row balance-snapshot provenance and PII-free identifiers.
- `admin-referrals-dashboard`: admin-only view of all referral relationships with status and cross-links to payout redemptions.

### Modified Capabilities
(none — no existing spec's requirements change; this only adds new admin-facing read views on top of existing Redemptions/Submissions/Referrals data)

## Impact

- New routes: `app/admin/purchases/page.tsx`, `app/admin/referrals/page.tsx`.
- New Airtable read helpers in `src/lib/airtable.ts`: list-all redemptions (not scoped to one email), list-all referrals, and a helper to compute the approved-submission balance snapshot as of a given timestamp for a given email.
- New components under `app/components/admin/` for the two tables, stat bars, and the expandable snapshot row.
- Reuses existing admin session-gating pattern (see `app/admin/timer/page.tsx`, `app/api/admin/*`).
- No changes to the redemption/referral write paths (`/api/admin/review`, `/redeem`) — this is a read-only reporting surface.
- No PII (email, address, birthday) is ever queried into these two pages' rendered output — only first name and GitHub handle.
