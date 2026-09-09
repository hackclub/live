## ADDED Requirements

### Requirement: Admin-only access
The system SHALL only render `/admin/referrals` for a session belonging to an admin email (per `isAdminEmail`), and SHALL redirect any other session to `/`.

#### Scenario: Non-admin visits the referrals dashboard
- **WHEN** a signed-in non-admin user requests `/admin/referrals`
- **THEN** the system redirects them to `/`

#### Scenario: Unauthenticated visitor visits the referrals dashboard
- **WHEN** a visitor with no session requests `/admin/referrals`
- **THEN** the system redirects them to the login flow

#### Scenario: Admin visits the referrals dashboard
- **WHEN** a signed-in admin user requests `/admin/referrals`
- **THEN** the system renders the referrals table

### Requirement: Referral list with no PII
The system SHALL list every referral relationship, showing only: row id, referrer GitHub handle (and first name when resolvable), referee GitHub handle and first name, and status (`pending` | `paid` | `void`). The system SHALL NOT include email anywhere in the page's rendered output or server response payload for this route.

#### Scenario: Referral row rendered
- **WHEN** the referrals dashboard loads
- **THEN** each referral is shown with its row id, referrer identity, referee identity, and status, and no email field is present in the page or its data payload

#### Scenario: Pending referral with no resolvable referrer first name
- **WHEN** a referral is `pending` and has no stored referrer email yet
- **THEN** the system shows the referrer's GitHub handle alone, without erroring

### Requirement: Referrals stat bar
The referrals dashboard SHALL show: total referral count, and counts broken down by status (`pending`, `paid`, `void`), and total hours generated via `paid` referral payouts (sum of `cost` on their linked redemptions, expected to be 0 per the current free-reward payout design but computed rather than hardcoded).

#### Scenario: Stat bar reflects current data
- **WHEN** the referrals dashboard loads
- **THEN** the stat bar's counts match the underlying referral list's status breakdown

### Requirement: Payout cross-link
A `paid` referral with a linked redemption SHALL show a link to that redemption's row on `/admin/purchases`.

#### Scenario: Paid referral with linked redemption
- **WHEN** a referral has `status = paid` and a linked redemption record
- **THEN** the row shows a link to the corresponding redemption on `/admin/purchases`

#### Scenario: Paid referral with no linked redemption
- **WHEN** a referral has `status = paid` but no linked redemption record present
- **THEN** the row renders without a broken link or error
