## ADDED Requirements

### Requirement: Referral code identity

Every authenticated user SHALL have a referral code equal to their GitHub username as reported by the current session, with no separate code generation or storage of the code itself.

#### Scenario: Code shown on dashboard

- **WHEN** an authenticated user opens `/dashboard`
- **THEN** the page displays their referral code (their GitHub username) and a shareable link of the form `<site-origin>/?ref=<github-username>`

#### Scenario: GitHub username unavailable

- **WHEN** an authenticated user opens `/dashboard` and the session cannot resolve a GitHub username
- **THEN** the referral section shows an inactive state explaining a GitHub-linked login is required to share a referral link
- **AND** no referral link is rendered

### Requirement: Referrer resolution map

The system SHALL maintain a `Referral Resolutions` table mapping a GitHub username (`Handle`) to an `Email`, and SHALL upsert the current user's row each time they open `/dashboard`.

#### Scenario: First dashboard visit records the mapping

- **WHEN** an authenticated user with GitHub username `octocat` and email `o@example.com` opens `/dashboard` and no `Referral Resolutions` row exists for `octocat`
- **THEN** the system creates a row `{ Handle: "octocat", Email: "o@example.com" }`

#### Scenario: Later visit refreshes the mapping

- **WHEN** an authenticated user opens `/dashboard` and a `Referral Resolutions` row already exists for their GitHub username
- **THEN** the system updates that row's `Email` to the caller's current email and does not create a duplicate row

#### Scenario: Resolving a handle to an email

- **WHEN** the system needs the email for handle `octocat`
- **THEN** it returns the `Email` from the `Referral Resolutions` row for `octocat` if present
- **AND** otherwise falls back to the `Email` of any `Submissions` record whose `GitHub Username` equals `octocat`
- **AND** otherwise reports the handle as unresolved

### Requirement: Referral link capture

The system SHALL capture a `ref` query parameter on any page load into a first-touch cookie and SHALL remove the parameter from the visible URL.

#### Scenario: First referral link visited

- **WHEN** a visitor loads any page with `?ref=octocat` and no referral cookie is set
- **THEN** the system sets a referral cookie to `octocat` with a 30-day lifetime
- **AND** the `ref` parameter is stripped from the URL the browser displays

#### Scenario: Subsequent referral links ignored

- **WHEN** a visitor loads a page with `?ref=someone-else` and a referral cookie is already set
- **THEN** the existing cookie value is left unchanged
- **AND** the `ref` parameter is stripped from the URL

#### Scenario: Empty or malformed ref

- **WHEN** a visitor loads a page with `?ref=` or a `ref` value that is not a plausible GitHub username
- **THEN** no referral cookie is set
- **AND** the parameter is stripped from the URL

### Requirement: Binding a referee to a referrer

The system SHALL create at most one `Referrals` row per referee email, recording the referrer handle, the source (`link` or `code`), a `status` of `pending`, and the bind timestamp. Binding SHALL be attempted automatically after authentication when a referral cookie is present, and on demand when a user submits a referral code on `/dashboard`.

#### Scenario: Automatic bind from cookie after login

- **WHEN** a user finishes authentication, a referral cookie `octocat` is present, the user has no `Referrals` row, and the user has no `Submissions` records
- **THEN** the system creates a `Referrals` row `{ Referee Email: <user email>, Referrer Handle: "octocat", Source: "link", Status: "pending", Bound At: <now> }`
- **AND** clears the referral cookie

#### Scenario: Manual bind from typed code

- **WHEN** a user with no `Referrals` row and no `Submissions` records submits the code `octocat` on `/dashboard`
- **THEN** the system creates a `Referrals` row with `Source: "code"` and `Status: "pending"`
- **AND** the dashboard then shows "Referred by @octocat"

#### Scenario: Referee already has a submission

- **WHEN** binding is attempted (by cookie or typed code) for a user who has one or more `Submissions` records
- **THEN** no `Referrals` row is created
- **AND** a typed-code attempt returns an error stating referrals must be entered before submitting a project

#### Scenario: Referee already bound

- **WHEN** binding is attempted for a user who already has a `Referrals` row
- **THEN** no second row is created and the existing referrer is unchanged

#### Scenario: Self-referral rejected

- **WHEN** binding is attempted where the referrer handle resolves to the referee's own email
- **THEN** no `Referrals` row is created
- **AND** a typed-code attempt returns an error stating you cannot refer yourself

#### Scenario: Unresolvable handle via typed code

- **WHEN** a user submits a referral code that resolves to no known email and matches no `Submissions` `GitHub Username`
- **THEN** no `Referrals` row is created and an "unknown referral code" error is returned

### Requirement: Referral payout on project approval

When a submission's review outcome becomes approved, the system SHALL, if the submitter is a `pending` referee, transition that `Referrals` row to `paid` exactly once and grant the referrer one free water balloon by creating a redemption.

#### Scenario: First approval triggers payout

- **WHEN** an admin approves a submission whose submitter email matches a `Referrals` row with `Status: "pending"`
- **THEN** the system resolves the referrer handle to an email
- **AND** creates a Redemptions row `{ Email: <referrer email>, Item Name: "water balloon thrown at me (referral reward)", Cost: 0 }`
- **AND** updates the `Referrals` row to `{ Status: "paid", Paid At: <now>, Referee Submission: <submission>, Redemption: <redemption> }`

#### Scenario: Payout is idempotent

- **WHEN** a submission is approved again, or another submission by the same already-paid referee is approved
- **THEN** the `Referrals` row stays `paid` and no additional redemption is created

#### Scenario: No referral for submitter

- **WHEN** an approved submission's submitter has no `Referrals` row
- **THEN** approval proceeds unchanged and no redemption is created

#### Scenario: Referrer handle cannot be resolved at payout

- **WHEN** payout runs but the referrer handle resolves to no email
- **THEN** the `Referrals` row is left `pending`
- **AND** approval of the submission still succeeds
- **AND** the payout is retried on the next approval event for that referee

#### Scenario: No cap on referrals earned

- **WHEN** a single referrer has multiple distinct referees whose projects are each approved
- **THEN** each referee produces one independent `paid` `Referrals` row and one water balloon redemption for the referrer

### Requirement: Dashboard referral surface

The `/dashboard` page SHALL show the signed-in user's referral link and code, whether they were referred and by whom, a code-entry control when eligible, and their referral totals.

#### Scenario: User has not been referred and has no submissions

- **WHEN** an eligible user with no `Referrals` row and no `Submissions` records views `/dashboard`
- **THEN** a "Enter a referral code" input is shown alongside their own referral link

#### Scenario: User has been referred

- **WHEN** a user with a `Referrals` row views `/dashboard`
- **THEN** the page shows "Referred by @<referrer handle>" and hides the code-entry input

#### Scenario: User has submissions but no referrer

- **WHEN** a user with one or more `Submissions` records and no `Referrals` row views `/dashboard`
- **THEN** the code-entry input is not shown

#### Scenario: Referral totals

- **WHEN** a user views `/dashboard`
- **THEN** the page shows how many people they have referred who shipped (count of `paid` `Referrals` rows for their handle) and how many water balloons that earned them
