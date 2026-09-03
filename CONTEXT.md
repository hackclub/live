# Context

## Current Task
Implemented `add-referral-program` — GitHub-username referral codes, first-touch `?ref` capture, and a free "water balloon thrown at me (referral reward)" redemption for the referrer when their referee's first project is approved.

## Key Decisions
- Referral code = GitHub username; `handle -> email` via lazy `Referral Resolutions` table (upserted on every `/dashboard` load), falling back to a `Submissions` scan.
- `?ref` capture lives in `proxy.ts` (Next 16's renamed Middleware); bind runs in the Hackatime OAuth callback and via `POST /api/referral/bind`; payout runs in `POST /api/admin/review` on approve, idempotent on the `Referrals` row `status`.
- Reward is a `cost: 0` Redemptions row — no token-balance or countdown-timer impact.

## Next Steps
- Create the `Referrals` and `Referral Resolutions` Airtable tables and fill `AIRTABLE_REFERRALS_TABLE_NAME` / `AIRTABLE_REFERRAL_RESOLUTIONS_TABLE_NAME` (local + Vercel).
- Manual e2e: link bind -> submit -> approve -> balloon appears; verify self-referral / already-bound / post-submission rejections.
- `/opsx:archive add-referral-program` once verified.
