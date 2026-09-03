## Context

The submission dashboard collects shipping address + birthday as manual form
inputs. A code comment in `src/lib/hackclub.ts` records the original reason: the
`address` / `birthdate` OAuth scopes on `auth.hackclub.com` are gated to
HQ-Official-tier apps, and a Community-tier app gets "invalid scope". That
constraint no longer applies — this app's client is HQ-Official and already
entitled to both scopes.

Current auth flow:

```
/api/auth/login  ── scope: "name email verification_status" ──▶ auth.hackclub.com/oauth/authorize
      │
      ▼  code
/api/auth/callback ── exchangeCodeForTokens ──▶ session cookie (jose, A256GCM)
      │
      ▼
/api/auth/hackatime/login ──▶ Hackatime OAuth (separate token)
      │
      ▼
/dashboard
   getIdentity(access_token) ──▶ auth.hackclub.com/api/v1/me ──▶ { id, first_name, last_name, primary_email }
   <SubmissionForm/>  ← new submission: address/birthday inputs blank + required
   /api/submit ── reads address/birthday from FormData ──▶ validateSubmissionInput ──▶ Airtable
```

`getIdentity` returns `data.identity` verbatim, so any additional claims granted
by wider scopes surface automatically once requested — the only code that needs
the new fields is the type definition and the consumers.

Airtable target fields (from `SUBMISSION_FIELDS`, confirmed against the live base):
`Address (Line 1)`, `Address (Line 2)`, `City`, `State / Province`, `Country`,
`ZIP / Postal Code`, `Birthday`.

## Goals / Non-Goals

**Goals:**
- Stop asking submitters to type address + birthday; source both from the HCA identity.
- Make the values un-spoofable: server derives them from `getIdentity`, ignores client input.
- Keep writing all address + birthday fields to Airtable unchanged (YSWS intake format).
- Block submission when the identity is incomplete, with a clear "go verify" message.
- Show the values in the form as disabled inputs so submitters can see what will be sent.

**Non-Goals:**
- Removing address/birthday from Airtable or the submission record shape.
- Letting submitters edit or override the identity-provided values (explicitly rejected).
- A fallback manual-entry path when the identity is incomplete (explicitly rejected — block instead).
- Migrating existing Airtable records' addresses to match the identity.
- Changing the Hackatime hop or any non-identity part of auth.

## Decisions

### D1: Add `address birthdate` to the single scope constant
`HACKCLUB_OAUTH_SCOPE` in `src/lib/hackclub.ts` becomes
`"name email verification_status address birthdate"`. `app/api/auth/login/route.ts`
already reads the constant, so no route change. Replace the stale comment with the
new rationale (scopes now available at this app's tier; fields autofilled, not
collected).

_Alternative — request the extra scopes only on a secondary authorize hop:_
rejected. No benefit here; every submitter needs the data, and a single consent
screen is simpler than a second redirect.

### D2: Server derives address + birthday from `getIdentity`; client values ignored
`/api/submit` already calls `getIdentity(session.access_token)` for
`first_name` / `last_name` / `primary_email`. Extend that identity object with the
address block + birthdate and build the Airtable `fields` map from it. Delete the
`addressLine1..zip` / `birthday` reads from `formData`. Even if a crafted request
includes those fields, they are never referenced.

_Alternative — trust the disabled-input values round-tripped by the browser:_
rejected. A disabled input is a client-side hint only; "not editable" has to be a
server guarantee.

### D3: Map the HCA address to the seven Airtable fields via one helper
Add `mapIdentityAddress(identity)` to `src/lib/hackclub.ts` returning
`{ addressLine1, addressLine2, city, state, country, zip } | null` (null when any
required component is absent). The submit route and the dashboard both call it, so
the mapping and the "complete?" check live in one place.

Field-name mapping is finalized against a live `/api/v1/me` response during
implementation (see Open Questions). Working assumption — OIDC `address` claim
shape, possibly wrapped in an array because the scope description says
"address(es)":

```
identity.address (object, or address[0] if array) → {
  street_address / line_1  → Address (Line 1)   (first physical line)
  line_2 / (2nd line of street_address)          → Address (Line 2)   (optional)
  locality / city          → City
  region / state           → State / Province
  postal_code / zip        → ZIP / Postal Code
  country                  → Country
}
identity.birthdate (OIDC "YYYY-MM-DD") → Birthday   (already the <input type=date> format)
```

If `street_address` arrives as one newline-joined string rather than discrete
lines, the helper splits on the first newline: line 1 = before, line 2 = the
remainder.

### D4: Block — never fall back to manual entry — on an incomplete identity
Define "identity complete for submission" =
`verification_status` indicates verified **AND** `mapIdentityAddress` returns
non-null **AND** `birthdate` is present and parseable.

- Dashboard: when incomplete, render the "submit a new project" panel as a notice
  ("Your Hack Club identity isn't fully verified yet — finish it at <link>, then
  come back to submit") instead of `<SubmissionForm/>`. Existing submissions list
  still renders.
- `/api/submit`: when incomplete, return `409` (or `400`) with
  `{ error: "identity_incomplete" }` and create/update nothing — mirrors the
  existing "either fully succeeds or fails loudly" stance.

_Alternative — keep the old editable fields as a fallback when the identity is
thin:_ rejected by the requester; a verified address is the whole point.

### D5: Form shows disabled inputs, drops `required` and validation
`SubmissionForm.tsx`: address (Line 1/2), City, State/Province, Country,
ZIP/Postal Code become `disabled` inputs bound to `defaults`; Birthday becomes a
`disabled` `<input type="date">` bound to `defaults.birthday`. Remove `required`
and the per-field `fieldErrors` for these. `defaults` is populated the same way
for a brand-new submission (from the identity) and a resubmission (also from the
identity — the identity is authoritative, not the old stored record values).
`validateSubmissionInput` / `SubmissionInput` drop the seven fields.

### D6: One-time forced logout is acceptable
A scope change means existing consent + tokens don't cover `address` / `birthdate`.
Rather than a silent re-consent dance, accept that all current sessions become
effectively unauthenticated for submission purposes: the incomplete-identity block
(D4) naturally routes them back through `/api/auth/login`, which now requests the
wider scope. No session-store purge needed — sessions are stateless cookies.

## Risks / Trade-offs

- **`/api/v1/me` shape is unverified for the new scopes** → confirm field names,
  array-vs-object, and country format against a real response before wiring the
  mapping; keep the mapping isolated in `mapIdentityAddress` so only one function
  changes.
- **Country format mismatch (ISO `US` vs `United States`)** → YSWS Airtable is a
  plain text field with `typecast: false`; whichever string HCA returns is written
  as-is. If ops needs a specific form, normalize in `mapIdentityAddress`. Decide
  during implementation by checking an existing good Airtable record.
- **Address is an array with more than one entry** → pick the primary/first;
  document the rule in the helper. No UI for choosing among addresses (non-goal).
- **Submitters with thin identities are now hard-blocked** → acceptable and
  intended, but the block message must link to the exact place to fix it, or it
  becomes a dead end. Copy needs the real URL.
- **Everyone is logged out on deploy** → expected; announce it. Low blast radius
  (small user base, re-login is one click + one consent).
- **Resubmissions now overwrite address/birthday with current identity values** →
  desirable (keeps records fresh), but a record submitted before this change could
  have its address change on resubmit. Acceptable — the identity is the source of
  truth.

## Migration Plan

1. Land the scope constant + type + `mapIdentityAddress` + consumer changes together.
2. Deploy. On deploy, existing sessions still decrypt but their identities won't
   carry address/birthdate → D4 block routes them to re-login with the new scope.
3. Announce the forced re-login in the stream's usual channel.
4. Rollback: revert the scope constant and the `/api/submit` + form changes. Users
   re-authenticated under the wider scope stay valid (extra scopes are harmless);
   no data migration to undo since Airtable field usage is unchanged.

## Open Questions

- Exact `/api/v1/me` JSON when `address` + `birthdate` are granted: key names
  (`street_address`/`line_1`, `locality`/`city`, `region`/`state`,
  `postal_code`/`zip`), object vs array, and `country` format. Resolve with one
  authenticated live call during implementation.
- Does `verification_status` alone certify the address, or is there a separate
  per-address verified flag / the `ysws_eligible` claim to check? Prefer
  `ysws_eligible` if it exists and means what it says.
- Block response code for `/api/submit`: `409 identity_incomplete` vs `403`.
- Exact URL the "finish your Hack Club identity" message should link to.
