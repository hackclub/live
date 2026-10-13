# Spec Delta

## Purpose

Gives admins one place to see every redeemer's purchases and to record which ones have been paid out or shipped, using the fulfillment fields on the Redemptions table.

## ADDED Requirements

### Requirement: Admin-only access
The fulfillment dashboard at `/admin/purchases` and every fulfillment API SHALL be available only to signed-in admins.

#### Scenario: Signed-out visitor
- **WHEN** a visitor without a session opens `/admin/purchases`
- **THEN** they are redirected to sign in

#### Scenario: Non-admin calls the fulfill API
- **WHEN** a signed-in non-admin sends a fulfill or unfulfill request
- **THEN** the request is rejected with an authorization error and no Redemptions record changes

### Requirement: Redemptions grouped per user
The dashboard SHALL show one section per redeemer, keyed by email compared case-insensitively with surrounding whitespace ignored. Each section SHALL show the redeemer's display name or GitHub handle when known, plus their total hours spent.

#### Scenario: Same person, different email casing
- **WHEN** two redemptions have emails `Ana@x.com` and ` ana@x.com`
- **THEN** both appear in the same user section

### Requirement: Identical items collapsed
Within a user section, redemptions with the same item name and cost and the same fulfillment state SHALL be shown as one line with a count (`×N`), total hours, and total USD at the payout rate ($5.00 per hour).

#### Scenario: Thirty one-hour grants
- **WHEN** a user has 30 unfulfilled `$6.5/hr Hardware Grant` redemptions costing 1 hour each
- **THEN** one unfulfilled line shows `$6.5/hr Hardware Grant ×30`, `30h`, `$150.00`

#### Scenario: Partially fulfilled group
- **WHEN** 10 of those 30 rows are fulfilled
- **THEN** the user section shows an unfulfilled `×20` line and a fulfilled `×10` line

### Requirement: Fulfilled and unfulfilled separated
A redemption SHALL count as fulfilled exactly when its `Fulfilled At` field has a value. Each user section SHALL list unfulfilled lines first, followed by fulfilled lines, which are collapsed by default.

#### Scenario: Row with Fulfilled At set
- **WHEN** a redemption has `Fulfilled At` set and `Status` empty
- **THEN** it is shown as fulfilled

### Requirement: Mark fulfilled
An admin SHALL be able to mark an unfulfilled line as fulfilled. Every redemption in that line gets `Fulfilled At` set to the current time and `Fulfilled By` set to the acting admin's email. No other Redemptions field is changed.

#### Scenario: Fulfill a group
- **WHEN** an admin clicks fulfill on an unfulfilled `×20` line
- **THEN** all 20 records get `Fulfilled At` and `Fulfilled By`, and the line moves to the fulfilled list without a full page reload

#### Scenario: Status untouched
- **WHEN** an admin fulfills a line
- **THEN** the records' `Status`, `Assignee` and `Notes` fields keep their previous values

### Requirement: No self-fulfillment
An admin SHALL NOT be able to fulfill or unfulfill their own redemptions. The server enforces this check, not just the UI, matching the existing self-refund rule.

#### Scenario: Admin fulfills own purchase
- **WHEN** an admin sends a fulfill request that includes a redemption whose email matches their own
- **THEN** the request is rejected and no record in it is changed

### Requirement: Mark unfulfilled
An admin SHALL be able to mark a fulfilled line as unfulfilled. This clears both `Fulfilled At` and `Fulfilled By` on every redemption in the line.

#### Scenario: Undo a fulfillment
- **WHEN** an admin clicks unfulfill on a fulfilled line
- **THEN** both fields are cleared on those records and the line moves back to the unfulfilled list

### Requirement: Fulfillment failure is visible
If a fulfill or unfulfill request fails for any record, the dashboard SHALL show an error on that line. It SHALL NOT show records as changed unless they were confirmed written.

#### Scenario: Airtable error mid-batch
- **WHEN** the first batch of 10 records is written and the second batch fails
- **THEN** the response reports which records were updated, the UI moves only those, and an error is shown for the rest

### Requirement: Refund and referral actions kept
The dashboard SHALL keep the existing per-redemption refund action (direct purchases only), the refund-all panel, and the link from referral-payout redemptions to their referral.

#### Scenario: Refund from a collapsed line
- **WHEN** an admin refunds an unfulfilled `×20` line of 1-hour grants and confirms
- **THEN** exactly one redemption is refunded and the line shows `×19`

#### Scenario: Referral payout row
- **WHEN** a redemption was created by a referral payout
- **THEN** its line shows a link to `/admin/referrals#<referralId>` and no refund button
