## Context

The program has no "user" entity today — `Submissions`, `Redemptions`, and `Referrals` are each independently keyed by an HCA email string pulled from `identity.primary_email` (HCA OAuth identity). Two auth patterns gate access:

- **Page-level**: `requireSession()` (`src/lib/auth.ts`) checks OAuth tokens exist and redirects if not, but doesn't know the user's email — `getIdentity()` is called separately, later, in each page (`app/dashboard/page.tsx`, `app/redeem/page.tsx`).
- **API-level**: `getSessionFromRequest()` reads the session cookie directly and returns `null` instead of redirecting (`app/api/submit/route.ts`, `app/api/shop/redeem/route.ts`, `app/api/admin/review/route.ts`, etc.).

Admin identity is a hardcoded env-var allowlist (`isAdminEmail` / `isReviewerEmail` in `src/lib/admin.ts`) — synchronous, no Airtable round-trip. A ban check is fundamentally different: it must look up a mutable, admin-editable list, so it has to be async and Airtable-backed.

`app/admin/page.tsx` has an explicit existing invariant: `QUEUE_FIELDS` never requests Name/Email/Address from Airtable for the review queue, specifically so reviewers can't see PII "even by accident." Any ban-related signal that reaches the admin queue UI must respect this.

## Goals / Non-Goals

**Goals:**
- Let an admin permanently ban a person (by HCA email) from the program via one click in the existing review queue.
- Banned users are locked out of `/dashboard` and `/redeem` with a clear "you were banned" message, and out of `/api/submit` and `/api/shop/redeem` at the API layer.
- Reviewers/admins see which historical submissions belong to a banned email via a "(banned user)" badge in the queue, without ever having the email itself sent to the client.
- Give admins a place to see and reverse bans (`/admin/banned`).
- Keep Ban fully independent of Fraud — no shared state, no change to Fraud's existing per-submission, non-cascading behavior.

**Non-Goals:**
- Retroactively changing `Approved`/`Review Status` on a banned user's past submissions — this is a visibility flag only, not a review verdict.
- Banning by anything other than HCA email (no IP bans, no device fingerprinting).
- Reviewer-initiated bans — banning is scoped to full admins only (`isAdminEmail`), since unlike Fraud (which a reviewer can already apply per-submission) a ban is a permanent, program-wide action.
- Real-time/session invalidation of an already-loaded page — enforcement happens on next navigation/request, same as every other auth check in this app today.

## Decisions

**1. New "Banned Users" Airtable table, not a field on Submissions.**
A ban is a property of a *person* (email), not of any one submission — the same submitter may have many submission records, and future submissions don't exist yet to carry a field. A dedicated table (`Email`, `Banned At`, `Banned By`, `Reason` optional) mirrors how `Referrals`/`Referral Resolutions` were added for the referral feature, and lets `/admin/banned` list bans directly without scanning Submissions.
*Alternative considered*: a boolean field on every Submission record, set at ban time via batch update. Rejected — doesn't cover future submissions (a banned user's next `/api/submit` call is already blocked before a record would be created, so there'd be nothing to flag anyway), and requires a write-fanout on every ban/unban instead of one row.

**2. Ban/unban helper is async and centralized in one module, used by every enforcement point.**
`src/lib/bans.ts` exports `isEmailBanned(email): Promise<boolean>`, `banEmail(email, bannedBy, reason?)`, `unbanEmail(email)`, `listBannedUsers()`. Every enforcement point (`dashboard`, `redeem`, `/api/submit`, `/api/shop/redeem`) calls the same `isEmailBanned`, so the definition of "banned" never drifts between surfaces.
*Alternative considered*: put ban logic in `src/lib/admin.ts` next to `isAdminEmail`/`isReviewerEmail`. Rejected for a plain naming/cohesion reason — those two are synchronous env-var checks; mixing in an async Airtable-backed check in the same file is a meaningfully different shape and would be surprising to a future reader expecting sync allowlist checks there.

**3. The ban *action* is server-resolved from `recordId`, never from an email the client supplies.**
`AdminQueue.tsx`'s new "Ban" button calls the review API with only `{ recordId, action: "ban" }` — identical shape to the existing approve/reject/fraud actions. The server (`/api/admin/review/route.ts`, extending its existing `ACTIONS` list) resolves `target.fields[SUBMISSION_FIELDS.email]` server-side — the same lookup the route already does today for the "cannot review own submission" check — and writes to Banned Users from there. This guarantees the client never needs to know, request, or transmit the submitter's email to trigger a ban.
*Alternative considered*: a new `/api/admin/ban` route that takes an email directly (useful for the standalone `/admin/banned` "ban by email" case). Kept as an **additional**, admin-only route for that one case, but the queue's row action never uses it — it always goes through `recordId` resolution.

**4. The "(banned user)" badge is a `boolean` computed server-side in `app/admin/page.tsx`, exactly like `duplicateHasApproved`.**
`app/admin/page.tsx` already does a second, cross-referencing scan over `allRecords` (fetched with a wider field set) to compute `duplicateRecordIds`/`duplicateHasApproved` per row without exposing those other records' contents to the client. Ban detection reuses this shape: fetch `SUBMISSION_FIELDS.email` into that server-only scan (it's never part of `QUEUE_FIELDS`, so it doesn't reach the client today and won't start now), check each email against `listBannedUsers()` (or `isEmailBanned` per unique email), and pass only `isBanned: boolean` into `AdminSubmissionRow`. `AdminQueue.tsx` renders the badge off that boolean — it never receives or displays an email.
*Alternative considered*: expose email to the client and flag client-side. Rejected outright — this is exactly the PII leak `QUEUE_FIELDS` was built to prevent, and the client-observable behavior (a badge) doesn't require it.

**5. `/admin/banned` is admin-only (not reviewer-accessible), matching the review route's new `ban` action.**
Mirrors `/admin/purchases` (admin-only) rather than `/admin/referrals` if that one happens to be reviewer-visible — a ban is a stronger action than anything reviewers currently do, so it gets the stricter gate.

**6. "You were banned" message replaces the page body, it doesn't redirect.**
`requireSession()` redirects on missing auth because there's somewhere useful to redirect *to* (a login flow). There's no useful redirect target for "you're banned" — the existing pattern for a terminal, non-actionable state is `app/dashboard/page.tsx`'s own "Couldn't load your Hack Club identity" branch, which renders an inline message instead of the normal dashboard body. The ban check reuses that shape.

## Risks / Trade-offs

- **[Risk]** An admin bans the wrong email (typo, wrong row) with no confirmation step → permanently locks out an innocent user. **Mitigation**: require a confirmation step in the UI (same pattern as Reject's required message) before the ban fires, and make unban a first-class, easy action on `/admin/banned`.
- **[Risk]** Extra Airtable round-trip on every `/dashboard`, `/redeem`, `/api/submit`, `/api/shop/redeem` call adds latency. **Mitigation**: these pages already make several parallel Airtable calls per load (`Promise.all` in `dashboard/page.tsx`); one more lookup is consistent with existing cost, and ban checks are a single indexed lookup by email, not a full table scan (`isEmailBanned` uses an Airtable filter formula, not `listBannedUsers()` + client-side scan, on the hot enforcement paths).
- **[Risk]** `app/admin/page.tsx`'s existing cross-reference scan (`allRecords`) grows one more field (`email`) that must never leak downstream. **Mitigation**: the field is consumed only inside the server-side loop that produces `isBanned`; it must never be attached to the `AdminSubmissionRow` object returned to the client — call this out explicitly in tasks.md and review it as part of implementation.
- **[Trade-off]** Ban is scoped to admins only, not reviewers, even though Fraud is reviewer-accessible. This is intentional (see Non-Goals) but means a reviewer who spots a repeat bad-faith submitter has to escalate to an admin rather than acting immediately — acceptable given the permanence of the action.

## Migration Plan

1. Create the "Banned Users" table in Airtable manually (same as prior changes' new-table setup) with `Email`, `Banned At`, `Banned By`, `Reason` fields; set `AIRTABLE_BANNED_USERS_TABLE_NAME` locally and in Vercel.
2. Ship `src/lib/bans.ts` + Airtable field constants first, with no callers wired in yet (safe no-op deploy).
3. Wire in enforcement (dashboard/redeem pages, submit/redeem API routes) — before this ships, the ban list is guaranteed empty, so no existing user is affected until an admin bans someone.
4. Wire in the admin queue Ban action, badge, and `/admin/banned` page.
5. Rollback: since nothing is denormalized onto existing Submission records, rollback is a plain revert of the code — no data migration to undo. An accidental ban is reversed by deleting/unbanning the one Banned Users row.

## Open Questions

- Should `/admin/banned` support banning by typing in an arbitrary email directly (for a person who hasn't submitted anything yet), or only via the queue's per-submission Ban button? Proposal assumes both (a small email-entry form on `/admin/banned` plus the queue button) but this hasn't been explicitly confirmed.
- Should banning a user also immediately fail any of their in-flight/pending submissions, or leave them exactly as-is (current assumption, per proposal) until an admin separately rejects them?
