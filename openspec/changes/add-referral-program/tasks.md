## 1. Airtable schema & env

- [ ] 1.1 Create the `Referrals` table in the Airtable base with fields: `Referee Email` (single line text), `Referrer Handle` (single line text), `Referrer Email` (single line text), `Source` (single select: `link`, `code`), `Status` (single select: `pending`, `paid`, `void`), `Bound At` (date/time), `Paid At` (date/time), `Referee Submission` (link to YSWS Project Submission), `Redemption` (link to Redemptions). **(manual — Airtable console)**
- [ ] 1.2 Create the `Referral Resolutions` table with fields: `Handle` (single line text), `Email` (single line text). **(manual — Airtable console)**
- [x] 1.3 Add `AIRTABLE_REFERRALS_TABLE_NAME` and `AIRTABLE_REFERRAL_RESOLUTIONS_TABLE_NAME` to `.env.local` (added, blank — fill with the table ids from 1.1/1.2) and Vercel env. Table field docs inline in `.env.local`.

## 2. Airtable data layer (`src/lib/airtable.ts`)

- [x] 2.1 Add `REFERRAL_FIELDS` and `REFERRAL_RESOLUTION_FIELDS` constants plus `REFERRAL_STATUS` (`pending` | `paid` | `void`) and `REFERRAL_SOURCE` (`link` | `code`), mirroring existing `*_FIELDS` style.
- [x] 2.2 Add `referralsTableConfig()` and `referralResolutionsTableConfig()` helpers matching the other `*TableConfig()` functions.
- [x] 2.3 Add `upsertReferralResolution(handle, email)` — find row by `Handle`, PATCH `Email` if present else POST a new row.
- [x] 2.4 Add `resolveReferrerEmail(handle)` — return `Referral Resolutions.Email` for the handle; else first `Submissions` record where `GitHub Username == handle` -> `Email`; else `null`.
- [x] 2.5 Add `getReferralByRefereeEmail(email)` and `getReferralByRefereeEmailAndStatus(email, status)`.
- [x] 2.6 Add `countPaidReferralsForHandle(handle)` returning the number of `paid` `Referrals` rows for that `Referrer Handle`.
- [x] 2.7 Add `createReferral({ refereeEmail, referrerHandle, source })` writing `Status = pending`, `Bound At = now`.
- [x] 2.8 Add `markReferralPaid({ referralId, referrerEmail, submissionRecordId, redemptionRecordId })` setting `Status = paid`, `Paid At = now` and the link fields.

## 3. Core referral logic (`src/lib/referral.ts`)

- [x] 3.1 Add `REF_COOKIE = "ref_handle"` and `isPlausibleGithubUsername(value)` (`/^[A-Za-z0-9-]{1,39}$/`, no leading/trailing/double hyphen).
- [x] 3.2 Implement `bindReferral({ refereeEmail, handle, source })` returning a discriminated result: reject with `self_referral` when `resolveReferrerEmail(handle)` equals `refereeEmail`; `already_bound` when `getReferralByRefereeEmail` exists; `already_submitted` when `listSubmissionsByEmail(refereeEmail)` is non-empty; `unknown_code` when `source === "code"` and the handle does not resolve and matches no submission GitHub username; otherwise `createReferral(...)` and return `ok`.
- [x] 3.3 Implement `payReferral(refereeEmail)`: load `pending` `Referrals` row (return if none); `resolveReferrerEmail` (return, leaving `pending`, if null); `createRedemption({ email: referrerEmail, itemName: "water balloon thrown at me (referral reward)", cost: 0 })`; `markReferralPaid(...)`. Wrap in try/catch that logs and swallows.
- [x] 3.4 Add `getCallerGithubUsername(session)` helper wrapping `getHackatimeMe(session.hackatime_access_token)` -> `github_username`.

## 4. `?ref` capture middleware

- [x] 4.1 Add `middleware.ts` at repo root with a `config.matcher` covering page routes (exclude `/api`, `/_next`, static assets). **(Next 16 renamed Middleware -> Proxy; file is `proxy.ts` exporting `proxy`.)**
- [x] 4.2 When `searchParams` has `ref`: if `isPlausibleGithubUsername(ref)` and no `ref_handle` cookie, set `ref_handle` (30-day, `httpOnly`, `sameSite=lax`, `path=/`) and 307-redirect to the URL with `ref` removed; if cookie already set or `ref` implausible, redirect to the stripped URL without setting the cookie.
- [ ] 4.3 Manually verify: first `?ref=octocat` sets the cookie and clean URL; a later `?ref=someoneelse` leaves the cookie unchanged; `?ref=` sets nothing.

## 5. Post-auth automatic bind

- [x] 5.1 In `app/api/auth/hackatime/callback/route.ts`, after the session is established, read the `ref_handle` cookie; if present, resolve the caller's `primary_email` via `getIdentity` and call `bindReferral({ refereeEmail, handle, source: "link" })`.
- [x] 5.2 Always clear the `ref_handle` cookie after the bind attempt (success or rejection).
- [x] 5.3 Ensure a bind failure never blocks the OAuth redirect (wrap in try/catch, log only).

## 6. Typed-code bind endpoint

- [x] 6.1 Add `POST /api/referral/bind` (`app/api/referral/bind/route.ts`): auth via `getSessionFromRequest` + `getIdentity` (401 if missing); parse `{ code }`; call `bindReferral({ refereeEmail, handle: code.trim(), source: "code" })`.
- [x] 6.2 Map results to responses: `ok` -> `{ ok: true, referrerHandle }`; `self_referral` / `already_bound` / `already_submitted` / `unknown_code` -> `400` with a stable `error` string.

## 7. Payout hook in admin review

- [x] 7.1 In `app/api/admin/review/route.ts`, after a successful `approve` `updateAirtableRecord`, load the submission via `getSubmissionById(recordId)` and read its `Email`.
- [x] 7.2 Call `payReferral(submitterEmail)`; log but do not fail the response on error.
- [ ] 7.3 Confirm idempotency by re-approving the same record and approving a second submission by the same referee — no extra redemption, row stays `paid`.

## 8. Dashboard referral section

- [x] 8.1 In the `/dashboard` server component, call `getCallerGithubUsername(session)` and `upsertReferralResolution(handle, primaryEmail)` (skip silently if no handle).
- [x] 8.2 Load `getReferralByRefereeEmail(primaryEmail)`, `listSubmissionsByEmail(primaryEmail)` (existence only), and `countPaidReferralsForHandle(handle)`.
- [x] 8.3 Add a `ReferralPanel` component: shows the referral link `${origin}/?ref=${handle}` + copy button and the code (or an inactive state when no handle); "Referred by @{referrerHandle}" when a `Referrals` row exists; referred-count and balloons-earned totals.
- [x] 8.4 Add a client `ReferralCodeForm` (posts to `/api/referral/bind`, shows returned errors, refreshes on success) rendered only when the user has no `Referrals` row and no submissions.

## 9. Validation & docs

- [x] 9.1 `openspec validate add-referral-program --strict` passes.
- [ ] 9.2 End-to-end manual test: user B opens B's dashboard (resolution row written); user A visits `/?ref=<B-handle>`, logs in fresh, binds; A submits a project; admin approves; B's Redemptions shows one `water balloon thrown at me (referral reward)` at cost 0 and B's dashboard shows 1 referral / 1 balloon.
- [ ] 9.3 Verify self-referral, second-referrer, and post-submission code entry are all rejected with the expected errors.
- [x] 9.4 Update `CONTEXT.md` and any env documentation with the two new table names.
