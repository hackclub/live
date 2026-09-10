## 1. Airtable helper

- [x] 1.1 Add `deleteRedemptionRecord(recordId: string): Promise<void>` in `src/lib/airtable.ts`, scoped to `redemptionsTableConfig()` (mirror the shape of `deleteAirtableRecord`, do not modify that existing function).

## 2. Refund API route

- [x] 2.1 Create `app/api/admin/purchases/refund/route.ts` with a `POST` handler.
- [x] 2.2 Auth: require a valid session (`getSessionFromRequest`), resolve identity (`getIdentity`), require `isAdminEmail` — reject non-admins (including reviewers) with 403, reject unauthenticated with 401.
- [x] 2.3 Parse `recordId` from the request body; reject with 400 if missing.
- [x] 2.4 Fetch the redemption server-side via `getRedemptionById(recordId)`; reject with 404 if not found.
- [x] 2.5 Reject with 400/403 if the record's `Cost` is `0` (referral payout) — never delete referral-payout rows even if requested directly.
- [x] 2.6 Reject with 403 if the record's `Email` matches the caller's identity email (case-insensitive) — self-refund block.
- [x] 2.7 On all checks passing, call `deleteRedemptionRecord(recordId)` and return `{ ok: true }`.

## 3. UI: refund button

- [x] 3.1 In `app/components/admin/PurchasesTable.tsx`, render a "refund" button only for rows with `cost > 0`, next to the existing "snapshot" button.
- [x] 3.2 On click, show a native `confirm()` dialog before proceeding (e.g. "Refund this purchase? This cannot be undone.").
- [x] 3.3 On confirm, POST to `/api/admin/purchases/refund` with `{ recordId: row.id }`.
- [x] 3.4 On success, remove the row from local state (no full page reload).
- [x] 3.5 On failure, show an inline error on the row (e.g. small text below the row) and keep the row in place.

## 4. Verification

- [ ] 4.1 Manual e2e: as admin, refund a direct purchase — row disappears, redeemer's `/redeem` balance increases by the refunded cost.
- [ ] 4.2 Manual e2e: confirm no refund button appears on referral-payout rows.
- [ ] 4.3 Manual e2e: attempt a refund API call directly for a referral-payout `recordId` — confirm it's rejected.
- [ ] 4.4 Manual e2e: as a reviewer (non-admin), attempt a refund — confirm 403.
- [ ] 4.5 Manual e2e: as an admin, attempt to refund a redemption whose email matches their own — confirm 403.
