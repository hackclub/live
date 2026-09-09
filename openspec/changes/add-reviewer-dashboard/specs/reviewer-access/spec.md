## ADDED Requirements

### Requirement: Reviewer role membership
The system SHALL determine reviewer membership from a `REVIEWER_EMAILS` environment variable (comma-separated, case-insensitive), mirroring the existing `ADMIN_EMAILS` allowlist pattern, via an `isReviewerEmail()` check independent of `isAdminEmail()`.

#### Scenario: Email present in REVIEWER_EMAILS
- **WHEN** a signed-in user's identity email matches an entry in `REVIEWER_EMAILS` (case-insensitive)
- **THEN** `isReviewerEmail()` returns true for that email

#### Scenario: Email absent from REVIEWER_EMAILS
- **WHEN** a signed-in user's identity email does not match any entry in `REVIEWER_EMAILS`
- **THEN** `isReviewerEmail()` returns false for that email

### Requirement: Reviewer dashboard access control
The system SHALL serve a `/review` page that is accessible to users who are admins or reviewers, and SHALL redirect all other authenticated or unauthenticated users away from it.

#### Scenario: Reviewer visits /review
- **WHEN** a user whose email is in `REVIEWER_EMAILS` requests `/review`
- **THEN** the system renders the review queue for that user

#### Scenario: Admin visits /review
- **WHEN** a user whose email is in `ADMIN_EMAILS` requests `/review`
- **THEN** the system renders the review queue for that user

#### Scenario: Unauthorized user visits /review
- **WHEN** a signed-in user whose email is in neither `ADMIN_EMAILS` nor `REVIEWER_EMAILS` requests `/review`
- **THEN** the system redirects them away from `/review`

#### Scenario: Unauthenticated user visits /review
- **WHEN** a user with no active session requests `/review`
- **THEN** the system redirects them to login

### Requirement: Scoped, non-PII submission fields on the reviewer dashboard
The `/review` queue SHALL expose only non-PII submission fields needed to judge a submission — screenshot, code URL, playable URL, lapse links, hackatime project name, description, hours, and review status — and SHALL NOT fetch or render Name, Email, Address, Birthday, a Telescreen link, or any link to timer control.

#### Scenario: Reviewer views a queue row
- **WHEN** a reviewer loads `/review`
- **THEN** each row displays screenshot, code URL, playable URL, lapse links, hackatime project name, description, hours, and review status, and does not display a Telescreen link

#### Scenario: No PII in the reviewer page payload
- **WHEN** the `/review` page fetches submission records from Airtable
- **THEN** the requested field list does not include Name, Email, Address, or Birthday

#### Scenario: No timer control link on the reviewer dashboard
- **WHEN** a reviewer loads `/review`
- **THEN** the page does not render a link to `/admin/timer`

### Requirement: Reviewer review actions
Reviewers SHALL be able to invoke the same review actions as admins — approve, reject, flag fraud, and adjust hours — through the existing review-action endpoint, with an optional justification on hours changes (whether made standalone or alongside approval).

#### Scenario: Reviewer approves a submission
- **WHEN** a reviewer submits an approve action for a submission that is not their own
- **THEN** the submission is marked approved and the action succeeds

#### Scenario: Reviewer rejects a submission with a message
- **WHEN** a reviewer submits a reject action with a required message for a submission that is not their own
- **THEN** the submission's review status is set to rejected and the action succeeds

#### Scenario: Reviewer flags a submission as fraud
- **WHEN** a reviewer submits a fraud action for a submission that is not their own
- **THEN** the submission's review status is set to fraud and the action succeeds

#### Scenario: Reviewer adjusts hours with justification
- **WHEN** a reviewer submits an hours action with a new hours value and a justification for a submission that is not their own
- **THEN** the submission's hours are updated and the justification is written to the override hours justification field

### Requirement: Self-review prevention
The system SHALL prevent a reviewer or admin from taking any review action on their own submission, enforced both in the reviewer queue (their own submission is excluded from the list) and in the review-action endpoint (independent of what the queue displayed).

#### Scenario: Own submission excluded from reviewer queue
- **WHEN** a reviewer whose email matches a submission's submitter email loads `/review`
- **THEN** that submission does not appear in their queue

#### Scenario: API rejects self-review attempt
- **WHEN** a caller (admin or reviewer) submits any review action against a submission whose submitter email matches the caller's own identity email
- **THEN** the endpoint rejects the request with a 403 error and makes no change to the submission

### Requirement: Reviewed-by attribution
Every review action, regardless of whether performed by an admin or a reviewer, SHALL record the caller's real identity email and a timestamp on the submission before any Airtable write completes.

#### Scenario: Reviewer action is attributed
- **WHEN** a reviewer successfully performs any review action on a submission
- **THEN** the submission's Reviewed By field is set to the reviewer's real identity email and Reviewed At is set to the time of the action

### Requirement: Hours-justification parity across roles
The standalone hours-adjustment action SHALL accept and persist an optional justification, for both admin and reviewer callers, consistent with the justification already supported on the approve-with-hours path.

#### Scenario: Standalone hours action with justification
- **WHEN** any authorized caller submits a standalone hours action with a justification
- **THEN** the submission's override hours justification field is updated with that justification

#### Scenario: Standalone hours action without justification
- **WHEN** any authorized caller submits a standalone hours action without a justification
- **THEN** the hours update succeeds and the justification field is left unchanged
