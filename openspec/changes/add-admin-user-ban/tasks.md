## 1. Airtable setup

- [ ] 1.1 Create the "Banned Users" table in Airtable with fields: Email, Banned At, Banned By, Reason (optional)
- [ ] 1.2 Add `AIRTABLE_BANNED_USERS_TABLE_NAME` to local `.env` and Vercel env (all environments)

## 2. Data layer

- [x] 2.1 Add `BANNED_USER_FIELDS` constant to `src/lib/airtable.ts` (email, bannedAt, bannedBy, reason)
- [x] 2.2 Add `getBannedUserByEmail(email)`, `listBannedUsers()`, `createBannedUser({ email, bannedBy, reason })`, `deleteBannedUser(recordId)` to `src/lib/airtable.ts`, using an Airtable filter formula for the by-email lookup (not a full-table scan)
- [x] 2.3 Create `src/lib/bans.ts` exporting `isEmailBanned(email): Promise<boolean>` (wraps `getBannedUserByEmail`), `banEmail(email, bannedBy, reason?)`, `unbanEmail(email)`

## 3. Enforcement — pages

- [x] 3.1 In `app/dashboard/page.tsx`, after `getIdentity()` resolves `identity.primary_email`, call `isEmailBanned` and render a "you were banned" message in place of the normal dashboard body if true (same shape as the existing "Couldn't load your Hack Club identity" branch)
- [x] 3.2 Apply the same check and message to `app/redeem/page.tsx`

## 4. Enforcement — APIs

- [x] 4.1 In `app/api/submit/route.ts`, after resolving the requester's identity/email, call `isEmailBanned` and return 403 if true, before creating a submission
- [x] 4.2 In `app/api/shop/redeem/route.ts`, apply the same check before creating a redemption

## 5. Admin ban action

- [x] 5.1 Add `"ban"` to the `ACTIONS` list in `app/api/admin/review/route.ts`; require full admin (`isAdminEmail`), not reviewer, for this action specifically
- [x] 5.2 Implement the `ban` branch: resolve `target.fields[SUBMISSION_FIELDS.email]` (already fetched via `getSubmissionById`), call `banEmail(email, identity.primary_email)`
- [x] 5.3 Add a "Ban" button to `app/components/admin/AdminQueue.tsx`, visually distinct from Approve/Reject/Fraud, with a confirmation step before it fires; button sends only `{ recordId, action: "ban" }`
- [x] 5.4 Hide/disable the Ban button for non-admin (reviewer-only) sessions in the queue UI, matching the server-side restriction

## 6. Admin queue ban badge (server-side, no PII to client)

- [x] 6.1 In `app/admin/page.tsx`, add `SUBMISSION_FIELDS.email` to `DUPLICATE_CHECK_FIELDS`'s underlying `allRecords` fetch (do NOT add it to `QUEUE_FIELDS`)
- [x] 6.2 In the existing cross-reference loop over `allRecords`, build a `Set`/`Map` of banned emails (via `listBannedUsers()`) and compute `isBanned` per record, alongside the existing duplicate-detection logic
- [x] 6.3 Thread `isBanned: boolean` into `AdminSubmissionRow` (extend the type in `AdminQueue.tsx`) — verify no code path attaches the raw email to this object
- [x] 6.4 Render a "(banned user)" badge in `AdminQueue.tsx` when `row.isBanned` is true
- [x] 6.5 `app/review/page.tsx` duplicates this same queue-building logic independently (see its own top-of-file comment) — mirror 6.1/6.2 there too, so reviewers also see the badge
- [x] 6.6 Add an `isAdmin: boolean` prop to `AdminQueue`; render the Ban button (5.3) only when true. `app/admin/page.tsx` always passes `true`; `app/review/page.tsx` passes `isAdminEmail(email)` since that page serves both roles

## 7. Admin ban-list page

- [x] 7.1 Create `app/admin/banned/page.tsx` (admin-only, redirect like `app/admin/page.tsx` if not `isAdminEmail`), listing `listBannedUsers()` with email, banned at, banned by, reason
- [x] 7.2 Add an "Ban by email" form on this page for banning someone with no submissions yet, posting to a new admin-only `app/api/admin/ban/route.ts` (or extend an existing admin route) that calls `banEmail` directly from a submitted email
- [x] 7.3 Add an unban action/button per row, calling `unbanEmail`
- [x] 7.4 Add a link to `/admin/banned` in the admin nav bar in `app/admin/page.tsx` (alongside the existing timer/purchases/referrals links)

## 8. Verification

- [ ] 8.1 Manual e2e: ban a test submitter from the queue → their `/dashboard` and `/redeem` show "you were banned" → their `/api/submit` and `/api/shop/redeem` calls 403
- [ ] 8.2 Manual e2e: their existing submissions show the "(banned user)" badge in the queue; confirm via network tab that no email is present in the admin page's client-side payload
- [ ] 8.3 Manual e2e: unban from `/admin/banned` restores dashboard/redeem/API access
- [ ] 8.4 Manual check: a reviewer session cannot trigger `ban`/unban (403) and doesn't see the Ban button or `/admin/banned`
