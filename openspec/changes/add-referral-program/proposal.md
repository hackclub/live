## Why

The stream has no growth loop — nothing rewards existing participants for bringing new people who actually ship. A referral program closes that loop: refer someone, and when their project is approved you get a water balloon thrown at you on stream (the shop's most visible, lowest-friction reward).

## What Changes

- Add a **referral program**: every logged-in user has a referral code equal to their GitHub username, plus a shareable link (`?ref=<handle>`).
- A new user can be **bound to one referrer** — via the link (captured to a first-touch cookie before login) or by typing a code on `/dashboard`. Binding is only allowed while the referee has **no submissions yet**.
- Guards: no self-referral, exactly one referrer per referee, later `?ref` values are ignored once a referrer is bound.
- **Payout** fires when the referee's first project is **approved** in admin review: the system auto-redeems `water balloon thrown at me` for the referrer at **cost 0**, recorded as `water balloon thrown at me (referral reward)` in the Redemptions table. Exactly one payout per referral, no cap on how many referrals one user can earn.
- `/dashboard` gains a referral section: the user's link/code, "Referred by @X" when they were referred, a code-entry input (shown only while they have no submissions and no referrer), and counts of people referred / balloons earned.
- New Airtable tables: `Referrals` (one row per referee, with status) and `Referral Resolutions` (lazy `handle → email` map, upserted when a user opens `/dashboard`).
- No change to token balances, the shop catalog, the countdown timer, or `getTokenBalance` — the reward is a normal zero-cost redemption row.

## Capabilities

### New Capabilities

- `referral-program`: referral code/link identity, referee-to-referrer binding rules, approval-triggered water-balloon payout, and the `/dashboard` referral surface.

### Modified Capabilities

<!-- None. The affected areas (dashboard, admin review, redemptions) don't have established specs in openspec/specs/ yet, and this change adds behavior rather than altering existing requirements. -->

## Impact

- **Code**: `src/lib/airtable.ts` (new `Referrals` + `Referral Resolutions` accessors; reuse `createRedemption`), `app/api/admin/review/route.ts` (payout hook on the approve path), `app/dashboard` (referral section + code-entry server action / route), new `?ref` capture (middleware or root-layout effect that sets the first-touch cookie and strips the param), `src/lib/hackatime.ts` / session usage for resolving the caller's GitHub username.
- **Airtable**: two new tables must exist before deploy — `Referrals` and `Referral Resolutions` — plus new env vars for their table names.
- **APIs**: new endpoint(s) under `app/api/referral/` for binding a typed code and reading referral status; admin review response unchanged.
- **No impact**: `src/lib/timer.ts`, `/api/obs/timer`, `getTokenBalance`, `src/lib/shopItems.ts` catalog.
