## MODIFIED Requirements

### Requirement: Submission form collects required fields, with identity fields autofilled read-only from HCA
The system SHALL require Code URL, Playable URL, Description, Screenshot, and required personal fields (First Name, Last Name, Email, GitHub Username, Address, Birthday). First Name, Last Name, Email, and GitHub Username are autofilled read-only from HCA/Hackatime identity. Address (Line 1), Address (Line 2), City, State/Province, Country, ZIP/Postal Code, and Birthday are sourced from the HCA identity, displayed in the form as disabled inputs (Birthday as a disabled date input) prefilled from that identity, and are NOT user-editable. Lapse Link(s) are optional.

#### Scenario: All required fields present with a complete identity
- **WHEN** a submit request includes all required project fields non-empty and the authenticated user's HCA identity is complete (verified, with a full mailing address and a birthdate)
- **THEN** the system proceeds to server-side validation and record creation

#### Scenario: A required project field is missing
- **WHEN** a submit request is missing Code URL, Playable URL, Description, or Screenshot (for a new record), or a track-specific required field
- **THEN** the system returns a structured error identifying the missing field(s) and creates no Airtable record

#### Scenario: Address and birthday inputs are display-only
- **WHEN** the submission form renders for a new submission or a resubmission
- **THEN** Address (Line 1/2), City, State/Province, Country, ZIP/Postal Code are shown as disabled inputs and Birthday as a disabled date input, each prefilled from the HCA identity, with no way for the user to edit them

### Requirement: Server-side validation is authoritative
The system SHALL independently re-validate every required project field server-side before writing to Airtable, regardless of client-side validation state. Address and birthday fields are NOT validated from client input because they are not accepted from the client (see "Address and birthday are sourced from the HCA identity, not client input").

#### Scenario: Client-side validation bypassed
- **WHEN** a submit request reaches the server with an invalid or missing required project field, even if the client believed it was valid
- **THEN** the system rejects the request the same as any other missing-field case

## ADDED Requirements

### Requirement: Address and birthday are sourced from the HCA identity, not client input
The system SHALL populate the Airtable `Address (Line 1)`, `Address (Line 2)`, `City`, `State / Province`, `Country`, `ZIP / Postal Code`, and `Birthday` fields from the authenticated user's HCA identity (fetched server-side via `getIdentity`) on every create and every update. The system SHALL NOT read these values from the submit request body, and SHALL ignore them if present.

#### Scenario: Request body carries address or birthday fields
- **WHEN** a submit request includes `addressLine1`, `city`, `birthday`, or any other address/birthday field in its body
- **THEN** the system ignores those values entirely and writes the values derived from the HCA identity instead

#### Scenario: Resubmission of an existing record
- **WHEN** an authenticated user resubmits one of their own existing records
- **THEN** the system overwrites that record's address and birthday fields with the current HCA identity values, not the values previously stored on the record

### Requirement: Submission is blocked when the HCA identity is incomplete
The system SHALL reject a submission — creating or updating no Airtable record — when the authenticated user's HCA identity is not fully verified, is missing any required mailing address component, or has no parseable birthdate. The dashboard SHALL replace the new-submission form with a notice directing the user to complete their Hack Club identity, and the submit API SHALL return a structured error (e.g. `identity_incomplete`) without writing to Airtable.

#### Scenario: Unverified or address-less identity loads the dashboard
- **WHEN** an authenticated user whose HCA identity is incomplete loads their dashboard
- **THEN** the system shows a notice with a link to finish their Hack Club identity in place of the new-submission form, while still listing their existing submissions

#### Scenario: Submit attempt with an incomplete identity
- **WHEN** a submit request arrives from an authenticated user whose HCA identity is incomplete
- **THEN** the system returns a structured `identity_incomplete` error and creates or updates no Airtable record

#### Scenario: Identity becomes complete after the user verifies
- **WHEN** a user who was blocked completes their Hack Club identity verification and reloads the dashboard
- **THEN** the system renders the new-submission form with address and birthday prefilled and disabled, and submission proceeds normally
