## Why

Hack Club OAuth (`auth.hackclub.com`) can return the submitter's verified mailing
address and date of birth once the `address` and `birthdate` scopes are requested —
scopes this app's OAuth client is already entitled to (HQ-Official tier). Today the
submission form asks every submitter to hand-type Address (Line 1/2), City,
State/Province, Country, ZIP/Postal Code, and Birthday on **every new submission**,
which is redundant, error-prone, and produces shipping addresses that were never
verified against Hack Club's records.

## What Changes

- **BREAKING**: `HACKCLUB_OAUTH_SCOPE` gains `address` and `birthdate`. Every
  existing session was minted under the old scope set and will be logged out;
  all users must re-authenticate and re-consent once.
- Address (Line 1), Address (Line 2), City, State/Province, Country, ZIP/Postal
  Code, and Birthday are **sourced from the HCA identity** (`getIdentity`) on the
  server, written to Airtable from that identity, and **never read from client
  form input**. The corresponding request fields are ignored if sent.
- The submission form renders those seven values as **disabled inputs** (birthday
  as a disabled `<input type="date">`) prefilled from the identity, for both new
  submissions and resubmissions. They are no longer user-editable and are dropped
  from `validateSubmissionInput`.
- **Submission is blocked** when the HCA identity is not fully verified or is
  missing any required address component or the birthdate. The submitter is shown
  a message directing them to complete their Hack Club identity, and no Airtable
  record is created or updated.
- Airtable still stores all address + birthday fields on every submission record —
  that is the format YSWS ops consumes submissions in; only the *source* of the
  values changes.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `hackclub-oauth`: the login authorization request SHALL include the `address`
  and `birthdate` scopes in addition to `name email verification_status`.
- `project-submission`: Address and Birthday become server-derived read-only
  fields from the HCA identity rather than manual form inputs; submission SHALL be
  rejected when the identity is unverified or missing those fields.

## Impact

- Code: `src/lib/hackclub.ts` (scope constant, `HackclubIdentity` type, address
  mapping helper), `app/api/auth/login/route.ts` (scope passthrough — no change if
  it reads the constant), `app/dashboard/page.tsx` (pass identity-derived
  `defaults` to the new-submission `SubmissionForm`, block render when incomplete),
  `app/components/dashboard/SubmissionForm.tsx` (disabled inputs, drop `required`),
  `app/api/submit/route.ts` (derive address/birthday from `getIdentity`, ignore
  form values, block on incomplete identity), `src/lib/submission.ts`
  (`validateSubmissionInput` drops address/birthday, `SubmissionInput` type).
- Auth: one-time forced re-login for all users (scope change invalidates consent).
- External: depends on the exact `/api/v1/me` identity JSON shape when `address` +
  `birthdate` scopes are granted — field names and whether `address` is an array
  are confirmed during implementation against a live response.
- No Airtable schema change: existing `Address (Line 1/2)`, `City`,
  `State / Province`, `Country`, `ZIP / Postal Code`, `Birthday` fields are reused.
