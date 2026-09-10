## Why

The `/admin/purchases` dashboard has no way to undo a redemption. When someone needs a refund (e.g. a mistaken or disputed purchase), the only fix today is manually deleting the row directly in Airtable, outside the app's auth and audit path.

## What Changes

- Add a "refund" button to each direct-purchase row (`cost > 0`) in `PurchasesTable`. Referral-payout rows (`cost === 0`) never get this button — refunding a free reward isn't a supported case.
- Add `POST /api/admin/purchases/refund`, admin-only (`isAdminEmail`, not reviewers), that deletes the Redemptions record by id.
- Block self-refund: an admin cannot refund a redemption whose email matches their own, mirroring the existing "cannot review own submission" guard.
- Add a redemptions-scoped delete helper in `src/lib/airtable.ts` — the existing `deleteAirtableRecord` is hardcoded to the Submissions table and cannot be reused as-is.
- Refund has no separate "restore hours" step: since token balance is computed live as earned hours minus `sumRedeemedCost()`, deleting the Redemptions row hands the hours back automatically.
- Client-side confirmation before the destructive call, since Airtable record deletion is unrecoverable.

## Capabilities

### New Capabilities
- `purchase-refunds`: Admin-only ability to refund a direct purchase by deleting its Redemptions record, with self-refund prevention and exclusion of referral-payout rows.

### Modified Capabilities
(none — no existing spec covers `/admin/purchases` behavior)

## Impact

- `app/components/admin/PurchasesTable.tsx` — new refund button + confirm + row removal per direct-purchase row.
- `app/api/admin/purchases/refund/route.ts` (new) — admin-only POST handler.
- `src/lib/airtable.ts` — new `deleteRedemptionRecord` (or similarly named) helper scoped to `redemptionsTableConfig()`.
- No schema changes to Airtable — this only deletes existing Redemptions rows.
