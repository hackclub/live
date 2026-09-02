## ADDED Requirements

### Requirement: Submission requires HCA login and Hackatime connection
The system SHALL only accept a project submission from a user with a valid HCA session and a connected Hackatime account.

#### Scenario: Unauthenticated or unconnected submit attempt
- **WHEN** a submit request arrives without a valid session, or without a connected Hackatime account
- **THEN** the system rejects the request with 401 and creates no Airtable record

### Requirement: Submission form collects required fields, with PII fields manual due to OAuth scope limits
The system SHALL require Code URL, Playable URL, Description, Screenshot, and required personal fields (First Name, Last Name, Email, GitHub Username, Address, Birthday), where First Name/Last Name/Email/GitHub Username are autofilled read-only from HCA/Hackatime identity and Address/Birthday are manual form inputs. Lapse Link(s) are optional.

#### Scenario: All required fields present
- **WHEN** a submit request includes all required fields non-empty
- **THEN** the system proceeds to server-side validation and record creation

#### Scenario: A required field is missing
- **WHEN** a submit request is missing any required field
- **THEN** the system returns a structured error identifying the missing field(s) and creates no Airtable record

### Requirement: Server-side validation is authoritative
The system SHALL independently re-validate every required field server-side before writing to Airtable, regardless of client-side validation state.

#### Scenario: Client-side validation bypassed
- **WHEN** a submit request reaches the server with an invalid or missing required field, even if the client believed it was valid
- **THEN** the system rejects the request the same as any other missing-field case

### Requirement: A person can have multiple submission records; resubmitting a specific one edits it in place
The system SHALL create a new Airtable record for every submission that does not reference an existing record by ID. When a submission references an existing record ID, the system SHALL verify the record's `Email` matches the authenticated user's email, then update that record rather than creating a duplicate, and SHALL reset `Review Status` to `Pending` on update. The system SHALL NOT look up or overwrite a record by email alone.

#### Scenario: New project submission
- **WHEN** an authenticated user submits without referencing an existing record
- **THEN** the system creates a new Airtable record, independent of any other records that user already has

#### Scenario: Resubmission of a specific rejected project
- **WHEN** an authenticated user submits while referencing one of their own existing records (any `Review Status`)
- **THEN** the system updates that specific record's fields with the new values and sets its `Review Status` back to `Pending`, leaving the user's other records untouched

#### Scenario: Attempted resubmission of someone else's record
- **WHEN** a submission references an existing record ID whose `Email` does not match the authenticated user's email
- **THEN** the system rejects the request and makes no change to that record

### Requirement: Submitter can see a personal total of hours contributed
The system SHALL let an authenticated user see the sum of `Optional - Override Hours Spent` across their own records where `Approved` is checked, representing how much they've personally increased the stream length by.

#### Scenario: User has one or more approved submissions
- **WHEN** an authenticated user with at least one `Approved` record loads their dashboard
- **THEN** the system displays the sum of `Optional - Override Hours Spent` across all of that user's `Approved` records

#### Scenario: User has no approved submissions
- **WHEN** an authenticated user with no `Approved` records loads their dashboard
- **THEN** the system displays a total of zero

### Requirement: Submitter can see a list of their own previous submissions
The system SHALL let an authenticated user see every submission record whose `Email` matches their own, each showing at least its `Review Status`/`Approved` state, Code URL, Playable URL, and work-log type and link if any.

#### Scenario: User has multiple submissions
- **WHEN** an authenticated user who has submitted more than one project loads their dashboard
- **THEN** the system displays all of that user's submission records, each with its own status

### Requirement: Submission track determines whether a Hackatime project is required
The system SHALL let the submitter choose a Software or Hardware track. For Software, a Hackatime project selection is required and hours are computed server-side from Hackatime. For Hardware, a Hackatime project is not required; instead the submitter chooses Lapse or Git Journal, provides the matching link and a self-reported hours value, and the system writes the labeled link to `Justification - Lapse Links, comma-separated` and the hours to `Optional - Override Hours Spent`.

#### Scenario: Software track without a selected project
- **WHEN** a Software-track submission does not include a valid Hackatime project selection
- **THEN** the system rejects the request with a field error and creates no record

#### Scenario: Hardware track without work-log evidence or hours
- **WHEN** a Hardware-track submission is missing its Lapse/Git Journal choice, matching link, or hours value
- **THEN** the system rejects the request with a field error and creates no record

#### Scenario: Hardware track submission
- **WHEN** a Hardware-track submission includes a Lapse or Git Journal choice, matching link, and hours value, with no Hackatime project selected
- **THEN** the system creates or updates the record with the selected work-log type, the submitted link, and the self-reported hours in `Optional - Override Hours Spent`, and does not require or contact Hackatime's projects endpoint

### Requirement: Submission either fully succeeds or fails loudly
The system SHALL NOT leave a partial Airtable record if any part of the submission process fails.

#### Scenario: Screenshot upload fails after record creation
- **WHEN** the Airtable record is created successfully but the screenshot attachment upload fails
- **THEN** the system deletes the just-created record and returns an error to the client

#### Scenario: Submission succeeds fully
- **WHEN** the Airtable record is created or updated and the screenshot attachment (if new) is uploaded successfully
- **THEN** the system returns success to the client

### Requirement: Submitter can view their own submission's review status and message thread
The system SHALL allow an authenticated user to view their own record's `Review Status` and its `Submission Messages` thread on their dashboard.

#### Scenario: User views their dashboard after a review decision
- **WHEN** an authenticated user with an existing record loads their dashboard
- **THEN** the system displays that record's current `Review Status` and the full message thread linked to it
