## 1. Confirm the HCA identity shape

- [ ] 1.1 With the wider scope granted, capture one live `GET /api/v1/me` response and record: address key names, object-vs-array, `country` format, `birthdate` format
- [ ] 1.2 Confirm what certifies the address as verified — `verification_status`, a per-address flag, or the `ysws_eligible` claim — and pick the check
- [ ] 1.3 Check an existing good Airtable submission record for the expected `Country` string form (ISO vs full name)

## 2. OAuth scope + identity mapping (`src/lib/hackclub.ts`)

- [x] 2.1 Change `HACKCLUB_OAUTH_SCOPE` to `"name email verification_status address birthdate"` and replace the stale "HQ-Official-tier-only / collected manually" comment with the new rationale
- [x] 2.2 Extend `HackclubIdentity` with the address block + `birthdate` (and `ysws_eligible` if used)
- [x] 2.3 Add `mapIdentityAddress(identity)` → `{ addressLine1, addressLine2, city, state, country, zip } | null` (null if any required component missing; select primary/first when address is an array; split `street_address` on first newline into line 1 / line 2 if lines aren't discrete)
- [x] 2.4 Add `isIdentityCompleteForSubmission(identity)` → boolean (verified AND `mapIdentityAddress` non-null AND parseable `birthdate`)
- [x] 2.5 Add a `birthdate` → `YYYY-MM-DD` normalizer if the raw value isn't already in that form

## 3. Submit API (`app/api/submit/route.ts`)

- [x] 3.1 Remove `addressLine1/addressLine2/city/state/country/zip/birthday` reads from `formData` and from the `input` object
- [x] 3.2 After `getIdentity`, reject with `{ error: "identity_incomplete" }` (409) and no Airtable write when `isIdentityCompleteForSubmission` is false
- [x] 3.3 Build the Airtable `fields` address + `Birthday` entries from `mapIdentityAddress(identity)` and the normalized birthdate, for both create and update paths
- [x] 3.4 Confirm `updateAirtableRecord` on resubmission overwrites address/birthday with identity values (no special-casing needed once 3.3 is done)

## 4. Validation + types (`src/lib/submission.ts`)

- [x] 4.1 Drop `addressLine1/addressLine2/city/state/country/zip/birthday` from `SubmissionInput`
- [x] 4.2 Remove the address/birthday entries from `COMMON_REQUIRED_FIELDS` in `validateSubmissionInput`
- [x] 4.3 Update any other `SubmissionInput` consumers/imports for the narrower type

## 5. Submission form (`app/components/dashboard/SubmissionForm.tsx`)

- [x] 5.1 Make Address (Line 1), Address (Line 2), City, State/Province, Country, ZIP/Postal Code `disabled` inputs bound to `defaults`, drop `required` and their `fieldErrors` rendering
- [x] 5.2 Make Birthday a `disabled` `<input type="date">` bound to `defaults.birthday`
- [x] 5.3 Keep `defaults` types for these fields; ensure the form still submits fine when they're absent from `FormData`

## 6. Dashboard (`app/dashboard/page.tsx`)

- [x] 6.1 Compute `mapIdentityAddress(identity)` + birthdate and pass them as `defaults` into the new-submission `<SubmissionForm/>` (currently rendered with no `defaults`)
- [x] 6.2 Pass the same identity-derived `defaults` into the resubmission form path (identity is authoritative over stored record values)
- [x] 6.3 When `isIdentityCompleteForSubmission` is false, render a notice with a link to finish Hack Club identity verification in place of the new-submission `<SubmissionForm/>`, keeping the existing-submissions list visible

## 7. Verify

- [x] 7.1 `npm run build` / typecheck passes with the narrowed `SubmissionInput` — `tsc --noEmit` (strict) passes; changed files lint clean. Full `next build` not run inside the worktree (Turbopack rejects a node_modules symlink pointing outside the worktree root); run it in a checkout with real `node_modules`.
- [ ] 7.2 Manual: fresh login shows the OAuth consent screen listing address + birthday; dashboard form shows them prefilled and disabled
- [ ] 7.3 Manual: submit writes identity-derived address + birthday to Airtable; a request with forged `addressLine1` in the body is ignored
- [ ] 7.4 Manual: an account without a verified address is blocked on both the dashboard and `POST /api/submit`
- [ ] 7.5 Manual: resubmitting an older record refreshes its address/birthday from the current identity
- [x] 7.6 `openspec validate add-oauth-identity-autofill --strict` passes

## 8. Rollout

- [ ] 8.1 Announce the one-time forced re-login (scope change invalidates existing consent)
- [ ] 8.2 Deploy; confirm blocked pre-change sessions get routed back through `/api/auth/login` with the new scope
