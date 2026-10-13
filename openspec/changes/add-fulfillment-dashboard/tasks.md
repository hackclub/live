# Tasks

## 1. Config and rates

- [x] 1.1 Add `PAYOUT_USD_PER_HOUR = 5` to `src/lib/hcb.ts` and update the `HOUR_VALUE_USD` comment to describe it as revenue per Unified hour (value stays 8.5); verify with `bun run lint`
- [x] 1.2 Expose the HCB balance fetch time (adjust `getHcbBalanceCents` or add a sibling helper after checking its callers), and confirm every caller still type-checks via `bun run build`
- [ ] 1.3 Add `UNIFIED_PAT`, `UNIFIED_APP_NAME`, `UNIFIED_TABLE_NAME` to Vercel production and preview; verify they appear in `vercel env ls` (or the dashboard)

## 2. Unified data access

- [x] 2.1 Create `src/lib/unified-airtable.ts` with its own cache (~60s TTL) and throttle, and `listLiveUnifiedProjects()` that pages through records filtered to `YSWS–Name` containing exactly `Live`, returning `{id,email,hours,codeUrl,playableUrl,approvedAt}[]` or `null` when env is missing or a request fails; verify with a throwaway script that it returns 131 records / ~1287.1h against current data
- [x] 2.2 Add `unifiedRecordUrl(id)` building `https://airtable.com/<base>/<table>/<id>` from env; verify a generated link opens the expected record

## 3. Live Airtable additions

- [x] 3.1 Add `REDEMPTION_FIELDS.fulfilledAt` / `fulfilledBy` ("Fulfilled At" / "Fulfilled By") to `src/lib/airtable.ts`; verify `bun run lint`
- [x] 3.2 Load submissions with one `listSubmissions` scan (fields: Email, First Name, GitHub Username, Approved, override hours, Code URL, Playable URL, Hackatime projects; no address/birthday) in `src/lib/fulfillment-data.ts`, covering both display identity and approved hours, replacing per-email identity lookups; verify it yields 168 approved / ~1493.3h
- [x] 3.3 Add `getRedemptionsByIds(ids)` (chunked `OR(RECORD_ID()=…)`) and `updateRedemptionRecords(updates)` (PATCH in chunks of 10, `typecast: false`, returns `{updated, failed}`), and verify a fulfill/unfulfill round-trip on one test redemption leaves every other field unchanged
- [x] 3.4 Add Code URL and Playable URL to the fields requested by `listApprovedSubmissionsBeforeForEmail`; verify the snapshot route still returns the same project names and hours

## 4. Classification and finance logic

- [x] 4.1 Create `src/lib/fulfillment.ts` with pure `normalizeEmail`, `normalizeCodeUrl`, `groupRedemptions` (per user → lines keyed by item name + cost + fulfilled state), `classifyUser` (EXPLOIT / OVERAGE / OK / UNKNOWN, epsilon 1e-9) and `computeFinances` (unfulfilled payout at $5, headline, revenue at $8.50, pending revenue, overage/exploit exposure incl. estimated unfulfilled portions); verify with a throwaway script over live data that it reproduces 45 OK / 12 OVERAGE / 4 EXPLOIT, 409.0h unfulfilled, 169.2h overage and 15.6h exploit (as of 2026-10-13, allowing for new purchases since)
- [x] 4.2 Verify edge cases with the same script: email casing/whitespace merge, trailing-slash Code URL match, 0.1h overspend → EXPLOIT, Unified `null` → UNKNOWN for non-exploiters

## 5. Fulfill API

- [ ] 5.1 Create `POST /api/admin/purchases/fulfill` (`{recordIds, fulfilled}`, max 200 IDs) with `requireAdmin`, reject 403 if any record belongs to the admin, write via `updateRedemptionRecords`, respond `{updated, failed}`; verify with curl: 401 signed out, 403 for a non-admin, 403 for own record, 400 for an empty or oversized list, and a success that sets or clears both fields in Airtable — *implemented; awaiting signed-in admin verification*

## 6. Snapshot extension

- [x] 6.1 Extend `GET /api/admin/purchases/snapshot` to return `codeUrl`, `playableUrl`, `inUnified`, `unifiedUrl` per project (matching via `listLiveUnifiedProjects`, degrading to `inUnified: false` / no link when Unified is unavailable); verify the JSON for a known matched project (e.g. RDINO-Devboard) has a working Unified link and contains no address or birthday fields

## 7. Dashboard UI

- [ ] 7.1 Rewrite `app/admin/purchases/page.tsx` to load redemptions, approved submissions, referrals, Unified and HCB in parallel, run `fulfillment.ts`, resolve display identities once per email, and pass serialized data to a client dashboard; keep the admin redirect; verify the page renders for an admin and redirects others — *implemented; awaiting signed-in admin verification*
- [ ] 7.2 Build `FinanceSummary`: HCB balance with fetch time, unfulfilled payout, headline "HCB − unfulfilled (self-funding overage)" with shortfall styling, revenue earned, pending revenue (informational), overage/exploit exposure (labelled estimate), and both rates; verify the numbers match the 4.1 script output — *implemented; awaiting signed-in admin verification*
- [ ] 7.3 Build `ExploitList` above the user cards with spent / local / overspent per user and anchor links, or a "no one has overspent" state; verify the links scroll to the right card — *implemented; awaiting signed-in admin verification*
- [ ] 7.4 Build `UserCard`: name/handle, status badge, spent / Unified / local hours, unfulfilled lines then a collapsed fulfilled list (item ×N, hours, $ at $5/hr), and a project list with in-Unified/local-only badges and code/playable/Unified links (new tab). Sort EXPLOIT → OVERAGE → OK → by unfulfilled hours, and collapse users with nothing unfulfilled; verify visually against a known OVERAGE user — *implemented; awaiting signed-in admin verification*
- [ ] 7.5 Wire fulfill/unfulfill buttons to the API with per-line pending and error state. Move only the IDs in `updated`, recompute groups and the unfulfilled finance figures client-side, and mark the headline as needing a refresh; verify by fulfilling then unfulfilling a test line and checking Airtable plus the updated totals — *implemented; awaiting signed-in admin verification*
- [ ] 7.6 Port refund (newest record of the line, existing confirm dialog, hidden for cost 0), referral links, snapshot toggle (rendering the new project links), and `RefundAllPanel` into the new UI. Delete `PurchasesTable.tsx` once unused; verify a refund on a `×N` line leaves `×N−1` and `bun run build` passes — *implemented; awaiting signed-in admin verification*

## 8. Integration check

- [ ] 8.1 Run `bun run lint` and `bun run build` clean, then do a full manual pass on a preview deploy: load time is acceptable, there are no Airtable 429s in logs, Unified-unavailable mode (unset `UNIFIED_PAT` locally) still renders with UNKNOWN badges, and HCB-unavailable shows `?` — *implemented; awaiting signed-in admin verification*

## Workflow follow-up

- Archive with `/opsx:archive add-fulfillment-dashboard` after the manual verification passes.
- When archiving, consider retiring the superseded `admin-purchases-dashboard` capability from the unarchived `add-admin-purchases-referrals-dashboards` change.
