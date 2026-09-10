## Why

Admins currently have only "Fraud" to act on a bad-faith submitter, and Fraud is deliberately per-submission and non-cascading (see `app/api/admin/review/route.ts`: "Fraud is terminal and single-record only — no cascading block on future submissions from the same person"). There's no way to stop a person from continuing to use the program at all — they can keep logging into the dashboard, submitting new projects, and redeeming prizes indefinitely. Admins need a separate, global "ban" action, keyed on the submitter's HCA email, that shuts a person out of the program entirely and marks their history for reviewers without exposing PII.

## What Changes

- Add a new "Banned Users" Airtable table (Email, Banned At, Banned By, optional Reason) as the source of truth for bans — the first email-keyed identity record in the system, separate from the per-table `REVIEW_STATUS.fraud` field.
- Add a new "Ban" row action in the admin review queue (`AdminQueue.tsx`), distinct from and independent of the existing Approve/Reject/Fraud/Hours actions. The client sends only `recordId`; the server resolves the associated email and writes the ban record — no email is ever sent to or requested by the client for this action.
- Block banned emails from the dashboard and redeem pages: `app/dashboard/page.tsx` and `app/redeem/page.tsx` show a "you were banned" message in place of the normal page once `getIdentity()` resolves a banned email.
- Block banned emails at the API layer too: `app/api/submit/route.ts` and `app/api/shop/redeem/route.ts` return 403 for a banned email, closing the gap where a banned user could bypass the UI and hit the API directly.
- Flag existing submissions from a banned email in the admin queue with a "(banned user)" badge, computed **server-side** in `app/admin/page.tsx` (cross-referencing the Banned Users table the same way duplicate-code-URL detection already works) and passed to the client only as a boolean — preserving the existing invariant that `QUEUE_FIELDS` never lets Name/Email/Address reach the client. Past submissions' `Review Status` / `Approved` fields are left untouched; this is a display-only flag.
- Add a new `/admin/banned` page (mirroring `/admin/purchases` and `/admin/referrals`) listing all banned emails with ban date/admin/reason, and an unban action.

## Capabilities

### New Capabilities
- `user-ban`: Banning a user by HCA email — the Banned Users data model, the ban/unban admin actions, and enforcement at the dashboard/redeem pages and submit/redeem API routes. Includes the server-side-only PII handling contract (email never crosses to the client for this feature).

### Modified Capabilities
(none — no existing spec covers admin review or dashboard access today; `nextjs-app-shell` is unaffected)

## Impact

- **Airtable**: new "Banned Users" table (manual setup before this ships, same pattern as prior changes' new tables).
- **New/changed code**:
  - `src/lib/airtable.ts` — Banned Users field constants + CRUD helpers (get by email, list, create, delete).
  - `src/lib/admin.ts` or a new `src/lib/bans.ts` — shared `isEmailBanned(email)` async helper used by every enforcement point.
  - `app/dashboard/page.tsx`, `app/redeem/page.tsx` — ban check + "you were banned" message.
  - `app/api/submit/route.ts`, `app/api/shop/redeem/route.ts` — ban check + 403.
  - `app/api/admin/review/route.ts` (or a new `app/api/admin/ban/route.ts`) — new `ban`/`unban` action, admin-only (not reviewer-accessible, matching the sensitivity of a permanent program-wide action).
  - `app/admin/page.tsx`, `app/components/admin/AdminQueue.tsx` — server-computed `isBanned` flag, new Ban button.
  - New `app/admin/banned/page.tsx` — ban list + unban.
- **No breaking changes** to existing Fraud/Approve/Reject behavior — this is additive.
