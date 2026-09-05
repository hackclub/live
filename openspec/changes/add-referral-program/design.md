## Context

The app has no persistent user table. Identity is a Hack Club OAuth session (`access_token`) plus a Hackatime OAuth leg (`hackatime_access_token`), both in an encrypted JWT cookie (`src/lib/session.ts`, `src/lib/auth.ts`). `getIdentity(access_token)` returns `{ primary_email, first_name, ... }`; `getHackatimeMe(hackatime_access_token)` returns `{ github_username }`. Every "user record" is rows-by-email in a domain table.

"Shipping a project" is a row in the `YSWS Project Submission` table that an admin marks `Approved = true` via `POST /api/admin/review` with `action: "approve"`. That route is the single chokepoint for approval. It currently receives only `recordId` + `action` and does not track whether an approval is the first for that submitter.

The "water balloon" is not a counter — it is the shop item `water balloon thrown at me` (`src/lib/shopItems.ts`, price 1). Each throw is a row in the Redemptions table (`createRedemption({ email, itemName, cost })`), and `getTokenBalance = personalApprovedHours - sumRedeemedCost`. A `cost: 0` redemption therefore adds a throw without touching any balance.

This change was explored in `/opsx:explore`; the decisions below are the locked outcomes.

## Goals / Non-Goals

**Goals:**

- Give every user a zero-setup referral code (their GitHub username) and a shareable `?ref=` link.
- Bind each new user to at most one referrer, first-touch, before they submit anything.
- On the referee's first project approval, grant the referrer exactly one free `water balloon thrown at me (referral reward)` redemption.
- Surface referral state and totals on `/dashboard`.
- Keep the payout path idempotent and safe to run inside admin review.

**Non-Goals:**

- No token-balance credit, no countdown-timer change, no shop-catalog change.
- No cap or rate-limit on referrals earned per user.
- No retroactive referrals (a code entered after the referee has already submitted does nothing).
- No new OBS overlay for balloon counts (the count is derivable from Redemptions if wanted later).
- No defence against a determined user creating a second Hack Club account to refer themselves — admin approval is the backstop.

## Decisions

### D1: Referral code = GitHub username, resolved through a lazy map

The code is the caller's `github_username` from Hackatime. No code generation, no collision handling, nothing stored for the code itself. Because a one-way hash of the email could never be resolved back to a person without a lookup table, and the username is already unique, human-typable, and URL-safe, it is the code.

Payout needs `handle -> email`. Nothing in the app resolves an arbitrary handle. So a `Referral Resolutions` table holds `{ Handle, Email }`, upserted every time a user loads `/dashboard` (they are authenticated there and `requireSession()` guarantees the Hackatime token). Resolution order: `Referral Resolutions` row, then fallback scan of `Submissions.GitHub Username` -> `Email`, then unresolved.

*Alternative considered:* resolve only via `Submissions`. Rejected because a referrer who never creates a submission would be unresolvable; the lazy map covers anyone who has opened their dashboard, which every referrer will have done to get their link.

### D2: `Referrals` table, one row per referee, small status machine

Fields: `Referee Email` (unique key), `Referrer Handle`, `Referrer Email` (filled at payout), `Source` (`link` | `code`), `Status` (`pending` | `paid` | `void`), `Bound At`, `Paid At`, `Referee Submission` (link), `Redemption` (link). Uniqueness on `Referee Email` is enforced in application code (check-then-create) since Airtable has no unique constraint.

State: `pending` on bind; `pending -> paid` on the referee's first approval; `void` reserved for manual admin correction. Idempotency of payout is derived purely from `Status`, so re-approving a submission or approving a second submission by the same referee is a no-op.

### D3: Binding is gated on "no submissions yet", checked at bind time

Eligibility to bind = the referee has zero rows in `Submissions` for their email (`listSubmissionsByEmail`) and no existing `Referrals` row. This is stricter than "before approval" and gives a single clear cutoff: once you have submitted anything, you can no longer attach a referrer. Self-referral is blocked by resolving the referrer handle and comparing to the referee email.

Two entry points, same core `bindReferral(refereeEmail, handle, source)`:

- **Link:** a `?ref=` capture layer sets a first-touch cookie; a post-auth step (in the Hackatime callback `app/api/auth/hackatime/callback/route.ts`, which already runs `getSessionFromRequest`) calls `bindReferral(..., "link")` when the cookie is present, then clears the cookie.
- **Typed code:** `POST /api/referral/bind` with `{ code }`, resolves caller via `getSessionFromRequest` + `getIdentity`, calls `bindReferral(..., "code")`, returns structured errors (`already_submitted`, `already_bound`, `self_referral`, `unknown_code`).

### D4: `?ref` capture via `middleware.ts`

The repo has no middleware yet. A new `middleware.ts` matched to page routes: if `ref` is a plausible GitHub username (`/^[A-Za-z0-9-]{1,39}$/`) and no `ref_handle` cookie is set, set `ref_handle` (30-day, `httpOnly`, `sameSite=lax`) and 307-redirect to the same URL without the `ref` param. If the cookie is already set, just strip the param. This keeps capture server-side and out of every page component.

*Alternative considered:* a `useEffect` in the root layout. Rejected — runs after hydration, races the first navigation, and needs `history.replaceState` gymnastics.

### D5: Payout runs inside `POST /api/admin/review` on `action === "approve"`

After `updateAirtableRecord(recordId, reviewFields)` succeeds for an approve, load the submission (`getSubmissionById`) to get its `Email`, then `payReferral(submitterEmail)`:

1. Find a `Referrals` row for `submitterEmail` with `Status === "pending"`; if none, return.
2. Resolve `Referrer Handle -> email`. If unresolved, leave `pending` and return (retried on the next approval).
3. `createRedemption({ email: referrerEmail, itemName: "water balloon thrown at me (referral reward)", cost: 0 })`.
4. Update the `Referrals` row: `Status = "paid"`, `Paid At`, `Referrer Email`, `Referee Submission`, `Redemption`.

Payout failures are logged but do not fail the approval response — the admin action is the source of truth and the payout is retriable.

### D6: Reward label

The redemption's `Item Name` is written verbatim as `water balloon thrown at me (referral reward)` so it reads distinctly in redemption history while still clearly being the water-balloon prize. `Cost` is `0`. The catalog entry `water balloon thrown at me` is used only to assert the prize still exists.

### D7: Dashboard surface

`/dashboard` (server component, `requireSession`) additionally:

- upserts the `Referral Resolutions` row for the caller;
- reads the caller's `Referrals` row (if any) and their `paid` referral count + derived balloon count for their handle;
- renders: referral link + copy control; "Referred by @X" when bound; a client code-entry form (posting to `/api/referral/bind`) shown only when the user has no `Referrals` row and no submissions.

## Risks / Trade-offs

- **[Airtable has no uniqueness / transactions]** Two concurrent binds or payouts for the same referee could double-write. → Bind is a check-then-create on a page action (low concurrency); payout is gated on `Status === "pending"` and the window is tiny. Accept a rare duplicate, fixable by setting a row to `void`.
- **[Handle unresolved at payout]** Referrer shared a hand-typed link and never opened `/dashboard`, and has no submission. → Row stays `pending` and pays on the referee's next approval; admin can also add a `Referral Resolutions` row manually.
- **[`Submissions` fallback picks a stale email]** A handle maps to an old submission with a different email than the person's current identity. → Prefer the `Referral Resolutions` row, which is refreshed on every dashboard visit; the scan is only a fallback.
- **[Reciprocal referrals A<->B]** Both can earn a balloon off each other. → Explicitly allowed (no cap); admin can `void` abuse.
- **[Middleware redirect on every `?ref` load]** One extra 307 per referred visitor. → Negligible; only fires when `ref` is present.
- **[Self-referral via second account]** Not preventable at this layer. → Out of scope; admin approval gates payout.

## Migration Plan

1. Create the `Referrals` and `Referral Resolutions` tables in the Airtable base with the fields in D1/D2.
2. Add env vars `AIRTABLE_REFERRALS_TABLE_NAME` and `AIRTABLE_REFERRAL_RESOLUTIONS_TABLE_NAME` (local + Vercel).
3. Ship code. With no rows present, `/dashboard` simply starts populating `Referral Resolutions`; no backfill needed.
4. Rollback: remove the `middleware.ts` matcher and the dashboard section; the payout hook is a no-op when no `pending` `Referrals` rows exist, so it can be left in place or reverted independently.

## Open Questions

- Should `/dashboard`'s code-entry also accept a full pasted `?ref=` URL, or handle-only? (Assumed handle-only; trivial to also parse a URL.)
- Do we want an admin view of `Referrals` rows for manual `void`, or is editing Airtable directly enough for now? (Assumed Airtable-direct.)
