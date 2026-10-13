# Design

## Context

- `/admin/purchases` (`app/admin/purchases/page.tsx`) is a server component. It lists every redemption flat (`listAllRedemptions`), resolves display identity per email, and renders `PurchasesTable` (client) with snapshot, refund and referral links, plus `RefundAllPanel` and a funding block that uses `HOUR_VALUE_USD` (8.5) as a payout rate.
- All Live-base Airtable access goes through `airtableRequest` in `src/lib/airtable.ts`. It has a GET cache keyed by table + path, invalidated per table on writes, and a global throttle of 4 requests/s for the one Live base.
- Redemptions already has `Fulfilled At` (dateTime) and `Fulfilled By` (text). They were filled in by hand: 203/389 are set and no code writes them. `Status`, `Assignee` and `Notes` are empty on every row.
- Unified "Approved Projects" (`app3A5kJwYqxMLOgh` / `tblzWWGUYHVH7Zyqf`) is a separate base with its own PAT. Live records have `YSWS–Name` (a rollup array) containing `Live`. Useful fields: `Email`, `Hours Spent` (formula), `Code URL`, `Playable URL`, `Approved At`. About 131 Live records, so two pages.
- Admin API routes each define a local `requireAdmin` (see `app/api/admin/purchases/refund/route.ts`).
- There is no test runner; verification is `bun run lint`, `bun run build` and manual checks against the live bases.

## Goals / Non-Goals

**Goals:**
- One page load gives a fully classified per-user view. All joins happen server-side from four bulk reads: redemptions, approved submissions, Unified Live records, HCB.
- Fulfill/unfulfill is a narrow, server-validated write to two fields.
- Unified access is isolated: its own module, credentials, cache and throttle, and it can fail without breaking the page.

**Non-Goals:**
- Writing anything to Unified.
- Tying a purchase to a specific project (hours aren't earmarked anywhere; the exposure split stays an estimate).
- Using or migrating the `Status` select.
- Historical point-in-time exploit detection. Classification uses current totals; the snapshot remains the approximate history view.
- Changing shop/redeem balance logic (`getTokenBalance`).

## Decisions

### 1. Separate `src/lib/unified-airtable.ts` instead of generalizing `airtableRequest`
`airtableRequest` takes `{apiKey, baseId, tableName}`, so it could technically be reused. But its throttle is a single module-level queue sized for the Live base's 5 req/s limit, and Airtable rate-limits per base. Sharing the queue would make Unified reads eat Live slots for no reason. So `unified-airtable.ts` gets a small copy of the fetch/cache/throttle pattern (cache TTL ~60s, since Unified changes slowly) and exports one function: `listLiveUnifiedProjects()`. That function returns `{ id, email, hours, codeUrl, playableUrl, approvedAt }[]` or `null` when unconfigured or failed.
- Alternative: export the internals from `airtable.ts` and add a per-base throttle map. That's cleaner long-term but touches every existing caller's hot path; not worth it for one read.

Filter: `filterByFormula=FIND('Live', ARRAYJOIN({YSWS–Name}))`, then exact `=== "Live"` on the array client-side. FIND alone would match `Lively`. Request only the needed `fields[]`.

### 2. Pure classification module
`src/lib/fulfillment.ts` holds pure functions with no I/O: `normalizeEmail`, `normalizeCodeUrl` (trim, strip trailing `/`), `groupRedemptions`, `classifyUser`, `computeFinances`. The page and the snapshot route both call them. Keeping them pure keeps the math in one place and makes it easy to verify against the numbers from the explore session (45 OK / 12 OVERAGE / 4 EXPLOIT; 409.0h unfulfilled) with a throwaway script.

Classification, using a small epsilon (1e-9) for float sums:
```
spent > local            → EXPLOIT
spent > unified          → OVERAGE
else                     → OK
unified data unavailable → UNKNOWN (only EXPLOIT can still be decided)
```

Unfulfilled exposure estimate per user (assumes the newest unfulfilled purchases are the ones over the line):
```
exploitUnf = min(unfulfilled, max(0, spent − local))
overageUnf = min(unfulfilled − exploitUnf, max(0, min(spent, local) − unified))
```

### 3. Rates in `src/lib/hcb.ts`
Add `PAYOUT_USD_PER_HOUR = 5` next to `HOUR_VALUE_USD = 8.5`, and update the latter's comment to say it is the revenue rate per Unified hour. `getHcbBalanceCents` gains a fetch timestamp, either by returning `{ cents, fetchedAt }` or through a sibling helper. Check its callers before changing the signature.

### 4. Fulfill API: `POST /api/admin/purchases/fulfill`
Body: `{ recordIds: string[], fulfilled: boolean }`, capped at a sane maximum such as 200. Server steps:
1. `requireAdmin` (same pattern as refund).
2. Fetch each record via the redemptions table (one `filterByFormula=OR(RECORD_ID()=…)` read per chunk) and reject the whole request with 403 if any record's email equals the admin's.
3. PATCH in chunks of 10 (Airtable's batch limit) through a new `updateRedemptionRecords(updates)` in `airtable.ts`. Fulfill sends `{ "Fulfilled At": now, "Fulfilled By": adminEmail }`; unfulfill sends `null` for both. Use `typecast: false`, and send no other fields.
4. Respond with `{ updated: string[], failed: string[] }`. Later chunks still run after a failure, so partial success is reported precisely.

The client sends record IDs only; it never sends emails. That matches the snapshot/refund approach. Grouping is a UI concern, so the client sends exactly the IDs of the line it is acting on.
- Alternative: send `{email, itemName, cost}` and let the server resolve the group. Rejected because it's racy with concurrent purchases and could fulfill a row the admin never saw.

### 5. Page data flow
```
page.tsx (server)
  ├─ listAllRedemptions()                  Live base
  ├─ listAllApprovedSubmissions()          Live base, new: Approved=TRUE,
  │     fields: Email, overrideHours, Code URL, Playable URL, hackatimeProjects
  ├─ listAllReferrals()                    (existing, referral links)
  ├─ listLiveUnifiedProjects()             Unified base (nullable)
  └─ getHcbBalanceCents()                  HCB (nullable)
        ↓ fulfillment.ts (pure)
  UserGroup[] + Finances  ──props──▶  FulfillmentDashboard (client)
                                        ├─ FinanceSummary
                                        ├─ ExploitList
                                        └─ UserCard × N
                                              ├─ item lines (fulfill / unfulfill / refund / snapshot / referral)
                                              └─ project list (badges + links)
```
Users are sorted EXPLOIT → OVERAGE → OK, then by unfulfilled hours (descending). Users with nothing unfulfilled are collapsed by default. The client keeps the redemption list in state; fulfill/unfulfill/refund mutate it and re-run the pure grouping and finance functions, so totals update without a reload. The headline stays pinned to its server value (see the fulfillment-finances spec).

Identity resolution (`resolveDisplayIdentityByEmail`) stays one call per distinct email, as it is today.

### 6. Snapshot extended, not replaced
`GET /api/admin/purchases/snapshot` keeps its "approved before this purchase" semantics. It additionally returns `codeUrl`, `playableUrl`, `inUnified` and `unifiedUrl` per project. `listApprovedSubmissionsBeforeForEmail` adds `Code URL` and `Playable URL` to its fields. The route calls `listLiveUnifiedProjects()` (cached) to match. The Unified URL is built from the env base and table IDs: `https://airtable.com/${UNIFIED_APP_NAME}/${UNIFIED_TABLE_NAME}/${recordId}`.

### 7. Refund on collapsed lines
The refund button on a `×N` line refunds one record: the newest in the line. That keeps refund's existing one-record API and confirm dialog unchanged.

## Risks / Trade-offs

- [Code URL matching misses projects whose URL was edited in one base] → Show "local only" (the conservative reading: the user looks like overage, not OK). The project list makes it easy to spot manually. Email-based matching was rejected because one Unified email already differs from local.
- [`Hours Spent` in Unified is a formula that can differ from local override hours after HQ review] → This is intended: Unified is the funded truth. The card shows both numbers.
- [Exposure split is an estimate] → Labelled "estimate" in the UI; the per-user totals it derives from are exact.
- [Full scans on every page load] → Four bulk reads (~4 Live requests + 2 Unified + 1 HCB), all cached. Comparable to the current page's load.
- [Concurrent admins fulfilling the same line] → Writes are idempotent (fulfill sets a timestamp, unfulfill clears it). The later write wins on `Fulfilled At`, which is acceptable.
- [Unified PAT leaked via client] → Only used in server modules. Never prefix with `NEXT_PUBLIC_`.

## Migration Plan

1. Add `UNIFIED_PAT`, `UNIFIED_APP_NAME`, `UNIFIED_TABLE_NAME` to Vercel (production and preview). They're already in local `.env`.
2. Deploy. No Airtable schema changes, and the existing 203 hand-stamped fulfillments are read as-is.
3. Rollback: revert the deploy. The fulfill route only touches two fields that were already hand-maintained, so no data cleanup is needed.
