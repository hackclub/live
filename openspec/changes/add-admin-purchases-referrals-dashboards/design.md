## Context

Redemptions (`Redemptions` Airtable table, `REDEMPTION_FIELDS`) and Submissions (`YSWS Project Submission`, `SUBMISSION_FIELDS`) are keyed by email with no per-redemption allocation of hours — `getTokenBalance` computes a live `earned - spent` number, and `createRedemption` just inserts a row once the balance check passes server-side (`app/api/shop/redeem/route.ts`). There is no stored "balance at time of purchase." Referrals (`Referrals` table, `REFERRAL_FIELDS`) track `status: pending | paid | void`, a `referrerHandle` (GitHub username, not email), and link fields `refereeSubmission` / `redemption` populated by `markReferralPaid` when a referral pays out.

Existing list helpers (`listRedemptionsByEmail`, `listSubmissionsByEmail`) are scoped to one person. Nothing today lists *all* redemptions or *all* referrals across every user — that's new.

Admin gating precedent: `app/admin/timer/page.tsx` — `getSession()` → `getIdentity(access_token)` → `isAdminEmail(identity.primary_email)` → `redirect("/")` if not admin. Both new routes reuse this exact pattern.

## Goals / Non-Goals

**Goals:**
- Give admins a read-only view of all redemptions and all referrals.
- For each redemption, reconstruct "what had they earned by then" from existing Submission data — no new write path, no new stored balance.
- Never surface email, address, or birthday on either page — first name + GitHub handle only.
- Link a referral's payout to its redemption row and vice versa, using the `redemption` / `refereeSubmission` link fields Airtable already stores.

**Non-Goals:**
- Not building a true per-purchase hour ledger/allocation system. The snapshot is an approximation, not an accounting record — hours were never earmarked at redemption time and this change doesn't start earmarking them.
- Not changing `/redeem`, `/api/shop/redeem`, `/api/admin/review`, or any existing write path.
- Not adding pagination/infinite-scroll in v1 — Redemptions/Referrals volumes are small enough for a single `listAll*` page-through (same `pageSize=100` + offset loop pattern already used elsewhere in `airtable.ts`).

## Decisions

**1. Balance snapshot = client-side reconstruction at read time, not a stored value.**
When an admin expands a purchases row, fetch that redeemer's submissions via a new `listApprovedSubmissionsBeforeForEmail(email, beforeIso)` helper: `AND({Email}='...', {Approved}=TRUE(), IS_BEFORE(CREATED_TIME(), '...'))` — mirrors the existing `getPersonalApprovedHours` filter shape but adds the `IS_BEFORE(CREATED_TIME(), ...)` clause, and returns the individual submission rows (not just a sum) so the UI can list them. `beforeIso` = the redemption's `redeemedAt`.
- *Alternative considered*: store a `Balance At Redemption` field on the Redemptions table, computed at `createRedemption` time. Rejected — would require a schema change to a write path that's out of scope, and doesn't help existing/past redemptions (they'd have no value). Read-time reconstruction works uniformly for all rows, past and future.

**2. Two new `listAll*` helpers, not a modification of the per-email ones.**
`listAllRedemptions()` and `listAllReferrals()` page through their tables with no `filterByFormula`, same offset-loop shape as `countApprovedHours`/`sumRedeemedCost`. Keeping them separate from `listRedemptionsByEmail`/`getReferralByRefereeEmail` avoids touching call sites already in use on `/dashboard` and the referral bind/payout flow.

**3. Identity resolution: first name + GitHub handle, looked up by joining on email server-side, never returned to the client as email.**
Redemptions and Referrals only store email (`REDEMPTION_FIELDS.email`, `REFERRAL_FIELDS.refereeEmail`/`referrerEmail`) or handle (`REFERRAL_FIELDS.referrerHandle`) — no first name. The server route/page resolves `email → {firstName, githubUsername}` via a lookup against Submissions (`findSubmissionByEmail` already exists; reuse it, requesting only `First Name` + `GitHub Username` via the existing `fields[]` restriction pattern used in `listSubmissions`) and returns just those two fields to the component. Email itself is never included in what's sent to the browser — this is a query/response-shape guarantee, following the same comment/pattern already in `listSubmissions` ("PII never leaves Airtable for the admin queue... a query-level guarantee, not just a render-level one").
- *Alternative considered*: resolve identity client-side by passing email down and formatting in the component. Rejected — email would then exist in the rendered payload/DOM even if not displayed, violating the "no PII" requirement at the wire level, not just visually.
- Referrer-side identity: `referrerHandle` is already a GitHub handle (no lookup needed for the handle itself); referrer *first name*, if shown, requires the same email→Submissions join once `referrerEmail` is populated (only set at payout time by `markReferralPaid`) — for `pending`/`void` referrals with no `referrerEmail` yet, fall back to showing the handle alone.

**4. Cross-linking via the `redemption` / `refereeSubmission` Airtable link fields already written by `markReferralPaid`.**
A referral's `fields[REFERRAL_FIELDS.redemption]` (an array of one linked record ID) is resolved against the `listAllRedemptions()` result set already fetched for `/admin/purchases` (both pages can share a single combined data-fetch or cross-reference by ID — implementation detail for tasks.md) to render a "→ view purchase" link. No new Airtable field needed; this is pure existing-data plumbing.

**5. Stats computed in-memory from the already-fetched list, not separate Airtable aggregate queries.**
`listAllRedemptions()`/`listAllReferrals()` results are small enough (same order of magnitude as Submissions, which the app already fully pages through elsewhere) to filter/count client- or server-side after one fetch, rather than issuing additional `filterByFormula` COUNT-style requests.

## Risks / Trade-offs

- **[Risk] The balance snapshot is an approximation, not ground truth** — if hours were ever manually adjusted (e.g. `overrideHours` edited after approval, or a submission un-approved/re-approved after a redemption), the reconstructed snapshot won't match what the redeemer's actual balance was at that exact moment. → **Mitigation**: label the UI clearly as "approved submissions as of this purchase" rather than implying a precise historical balance; this matches the user's explicit "not a strict accounting ledger" framing.
- **[Risk] `listAllRedemptions()`/`listAllReferrals()` with no filter could grow expensive as tables grow.** → **Mitigation**: same offset-paging pattern already handles this at Submissions' current scale; revisit with real pagination if row counts get large enough to matter (non-goal for v1, noted above).
- **[Risk] Referrer first name is unavailable for `pending` referrals (no `referrerEmail` stored until payout).** → **Mitigation**: fall back to GitHub handle only, which is already the primary referrer identifier the user asked to keep.
- **[Trade-off] Two separate routes instead of one combined page** means some duplicated stat-bar/table scaffolding, but matches the user's explicit ask for two interlinked-but-separate dashboards (mirrors `/admin` vs `/admin/timer` already being separate today).

## Migration Plan

No data migration — purely additive read surfaces. No existing Airtable fields, tables, or write paths change. Deploy is just shipping the two new routes/components/helpers; no env vars beyond the already-configured `AIRTABLE_REDEMPTIONS_TABLE_NAME` / `AIRTABLE_REFERRALS_TABLE_NAME` are needed.

## Open Questions

- Should `/admin` (the main queue page) gain a nav link to these two new pages, matching how `/admin/timer` is already linked? (Likely yes — folding into tasks.md as a small nav addition.)
- Exact "how many joined via referral vs organic" stat the user mentioned wanting to see — confirmed as `cost===0` vs `cost>0` redemption split on `/admin/purchases`; a separate "referral signups vs organic signups" count (independent of purchases) was raised as a possible second reading but not confirmed — left out of scope for this change unless requested.
