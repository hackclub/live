## ADDED Requirements

### Requirement: Ban a user by HCA email
The system SHALL allow an admin to ban a person, identified by their HCA email address, from the program. Bans SHALL be stored independently of any submission's `Review Status`/`Approved` fields, and SHALL be a distinct action from marking a submission as Fraud.

#### Scenario: Admin bans a submitter from the review queue
- **WHEN** an admin clicks "Ban" on a submission row in the admin review queue and confirms
- **THEN** the system resolves that submission's associated email server-side and creates a ban record for it, without the client ever sending or receiving that email

#### Scenario: Reviewer cannot ban
- **WHEN** a user authenticated only as a reviewer (not a full admin) calls the ban action
- **THEN** the system rejects the request as forbidden, the same way it already restricts other admin-only actions

#### Scenario: Banning does not alter existing Fraud state
- **WHEN** a submission previously marked Fraud belongs to an email that is later banned
- **THEN** that submission's `Review Status` remains `Fraud`, unchanged by the ban

### Requirement: Banned users are blocked from the dashboard and redeem pages
The system SHALL prevent a banned email from using `/dashboard` or `/redeem`, showing a message stating they were banned instead of the normal page content.

#### Scenario: Banned user visits the dashboard
- **WHEN** a user whose HCA email is on the ban list loads `/dashboard`
- **THEN** the page renders a message stating they were banned instead of their submissions, tokens, or submission form

#### Scenario: Banned user visits the redeem page
- **WHEN** a user whose HCA email is on the ban list loads `/redeem`
- **THEN** the page renders a message stating they were banned instead of the redemption UI

#### Scenario: Non-banned user is unaffected
- **WHEN** a user whose HCA email is not on the ban list loads `/dashboard` or `/redeem`
- **THEN** the page renders normally, with no ban-related check visible

### Requirement: Banned users are blocked from submission and redemption APIs
The system SHALL reject requests to `/api/submit` and `/api/shop/redeem` from a banned email, independent of whether the request originated from the app's own UI.

#### Scenario: Banned user calls the submit API directly
- **WHEN** a request to `/api/submit` resolves to an HCA email on the ban list
- **THEN** the system responds with a 403 error and does not create a submission

#### Scenario: Banned user calls the redeem API directly
- **WHEN** a request to `/api/shop/redeem` resolves to an HCA email on the ban list
- **THEN** the system responds with a 403 error and does not create a redemption

### Requirement: Admin queue flags submissions from banned users without exposing email
The system SHALL indicate, in the admin review queue, when a submission belongs to a banned email, using a badge computed server-side, and SHALL NOT transmit the submitter's email to the client as part of this feature.

#### Scenario: Submission from a banned email is flagged in the queue
- **WHEN** an admin or reviewer views the review queue and a listed submission's associated email is on the ban list
- **THEN** the row displays a "(banned user)" badge

#### Scenario: Ban flag never carries the email to the client
- **WHEN** the admin review queue page is rendered for any submission
- **THEN** the response sent to the client contains only a boolean ban indicator for that row, never the submitter's email address

#### Scenario: Submission from a non-banned email shows no badge
- **WHEN** an admin or reviewer views the review queue and a listed submission's associated email is not on the ban list
- **THEN** the row displays no ban-related badge

### Requirement: Admin can view and reverse bans
The system SHALL provide an admin-only page listing all currently banned emails with when and by whom each was banned, and SHALL allow an admin to unban an entry from that page.

#### Scenario: Admin views the ban list
- **WHEN** an admin navigates to the banned-users admin page
- **THEN** the system displays every currently banned email along with its ban date and the admin who banned it

#### Scenario: Admin unbans a user
- **WHEN** an admin clicks unban on an entry in the banned-users admin page
- **THEN** the system removes that ban record, and the previously banned email can access `/dashboard`, `/redeem`, and the submit/redeem APIs again

#### Scenario: Non-admin cannot access the ban list page
- **WHEN** a user who is not a full admin (including a reviewer) navigates to the banned-users admin page
- **THEN** the system denies access, consistent with other admin-only pages
