## 1. Airtable helpers (`src/lib/airtable.ts`)

- [x] 1.1 Add `listAllRedemptions()` — pages through the Redemptions table with no `filterByFormula`, same offset-loop shape as `sumRedeemedCost`/`countApprovedHours`, returns full records.
- [x] 1.2 Add `listAllReferrals()` — same paging shape against the Referrals table, returns full records.
- [x] 1.3 Add `listApprovedSubmissionsBeforeForEmail(email, beforeIso)` — filter `AND({Email}='...', {Approved}=TRUE(), IS_BEFORE(CREATED_TIME(), '...'))`, request only the fields needed to render a snapshot row (e.g. hackatime project name, hours, created time) — no address/birthday fields.
- [x] 1.4 Add a helper to resolve `email -> { firstName, githubUsername }` for display purposes, reusing `findSubmissionByEmail` with a `fields[]` restriction to `First Name` + `GitHub Username` only (never email, address, or birthday returned by this helper).

## 2. `/admin/purchases` route

- [x] 2.1 Create `app/admin/purchases/page.tsx` gated the same way as `app/admin/timer/page.tsx` (`getSession` → `getIdentity` → `isAdminEmail` → redirect `/` on failure).
- [x] 2.2 Fetch `listAllRedemptions()`, resolve each redemption's redeemer identity via the helper from 1.4, and shape rows with: id, first name, GitHub handle, item name, cost, redeemedAt — no email in the shaped data.
- [x] 2.3 Fetch `listAllReferrals()` alongside (or pass down) to compute, per redemption, whether it's linked from a `Referrals.Redemption` field — build an id → referral-id map for cross-linking.
- [x] 2.4 Compute stat-bar values: total count, `cost > 0` count, `cost === 0` count, sum of `cost`.
- [x] 2.5 Render a table/list component (`app/components/admin/PurchasesTable.tsx`) with expandable rows.
- [x] 2.6 On row expand, call `listApprovedSubmissionsBeforeForEmail` (client fetch to a small route handler, or pass pre-fetched data if volume allows) and render the submission list + summed hours, labeled as an approximate snapshot, not a precise balance.
- [x] 2.7 Render the referral cross-link (from 2.3) when present, pointing to `/admin/referrals#<referral-id>` or similar.

## 3. `/admin/referrals` route

- [x] 3.1 Create `app/admin/referrals/page.tsx` with the same admin gating pattern.
- [x] 3.2 Fetch `listAllReferrals()`, resolve referrer/referee identity (first name via 1.4 where email is available; referrer handle always available from `REFERRAL_FIELDS.referrerHandle`; fall back to handle-only when no `referrerEmail` yet, i.e. `pending`/`void`).
- [x] 3.3 Compute stat-bar values: total count, counts per `status` (`pending`/`paid`/`void`), total hours from `paid` referrals' linked redemption costs.
- [x] 3.4 Render a table component (`app/components/admin/ReferralsTable.tsx`).
- [x] 3.5 Render the payout cross-link to `/admin/purchases#<redemption-id>` when a `paid` referral has a linked redemption; render without a link (no error) when it doesn't.

## 4. Navigation & polish

- [x] 4.1 Add links from `/admin` to `/admin/purchases` and `/admin/referrals` (matching the existing `/admin/timer` back-link pattern).
- [x] 4.2 Add back-links from each new page to `/admin`.
- [x] 4.3 Verify no email/address/birthday field appears in either page's rendered HTML or server response payload (manual check of page source / network tab).

## 5. Verification

- [ ] 5.1 Manually verify: non-admin session redirected away from both new routes.
- [ ] 5.2 Manually verify: a redemption row's expanded snapshot matches the redeemer's actual approved submissions before `redeemedAt`.
- [ ] 5.3 Manually verify: a `cost === 0` redemption originating from a referral payout cross-links correctly to its referral row, and vice versa.
- [ ] 5.4 Manually verify: stat bars on both pages match manual counts against the Airtable base.
