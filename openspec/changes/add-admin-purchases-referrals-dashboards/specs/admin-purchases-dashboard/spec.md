## ADDED Requirements

### Requirement: Admin-only access
The system SHALL only render `/admin/purchases` for a session belonging to an admin email (per `isAdminEmail`), and SHALL redirect any other session to `/`.

#### Scenario: Non-admin visits the purchases dashboard
- **WHEN** a signed-in non-admin user requests `/admin/purchases`
- **THEN** the system redirects them to `/`

#### Scenario: Unauthenticated visitor visits the purchases dashboard
- **WHEN** a visitor with no session requests `/admin/purchases`
- **THEN** the system redirects them to the login flow

#### Scenario: Admin visits the purchases dashboard
- **WHEN** a signed-in admin user requests `/admin/purchases`
- **THEN** the system renders the redemptions table

### Requirement: Redemption list with no PII
The system SHALL list every redemption across all users, showing only: row id, redeemer first name, redeemer GitHub handle, item name, cost, and redeemed date. The system SHALL NOT include email, address, or birthday anywhere in the page's rendered output or server response payload for this route.

#### Scenario: Redemption row rendered
- **WHEN** the purchases dashboard loads
- **THEN** each redemption is shown with its row id, redeemer first name, redeemer GitHub handle, item name, cost, and redeemed date, and no email/address/birthday field is present in the page or its data payload

### Requirement: Balance snapshot on expand
Each redemption row SHALL be expandable to show a balance snapshot: every submission approved before that redemption's `redeemedAt` timestamp, for that same redeemer, summed to a total hours figure, labeled as an approximation rather than a precise historical balance.

#### Scenario: Admin expands a redemption row
- **WHEN** an admin expands a redemption row
- **THEN** the system shows the list of that redeemer's submissions with `Approved = true` and a creation time before the redemption's `redeemedAt`, along with their summed hours

#### Scenario: Redeemer has no prior approved submissions
- **WHEN** an admin expands a redemption row for a redeemer with no approved submissions before `redeemedAt`
- **THEN** the system shows an empty/zero-hours snapshot rather than an error

### Requirement: Purchases stat bar
The purchases dashboard SHALL show: total redemption count, count of direct purchases (`cost > 0`), count of referral-payout redemptions (`cost === 0`), and total hours spent (sum of `cost` across all redemptions).

#### Scenario: Stat bar reflects current data
- **WHEN** the purchases dashboard loads
- **THEN** the stat bar's counts and totals match the underlying redemption list

### Requirement: Referral-payout cross-link
A redemption row that originated from a referral payout (`cost === 0` and linked from a `Referrals` record's `Redemption` field) SHALL show a link to that referral's row on `/admin/referrals`.

#### Scenario: Referral-payout redemption row
- **WHEN** a redemption row corresponds to a paid referral's payout
- **THEN** the row shows a link to the corresponding referral on `/admin/referrals`
