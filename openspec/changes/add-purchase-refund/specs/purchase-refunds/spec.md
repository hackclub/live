## ADDED Requirements

### Requirement: Admin can refund a direct purchase
An admin viewing `/admin/purchases` SHALL be able to permanently refund any redemption record whose cost is greater than zero, by deleting its Redemptions record. Deleting the record SHALL restore the redeemer's token balance, since balance is computed live as approved hours minus the sum of remaining redemption costs.

#### Scenario: Admin refunds a direct purchase
- **WHEN** an admin clicks "refund" on a purchase row with `cost > 0` and confirms the action
- **THEN** the corresponding Redemptions record is deleted from Airtable and the row is removed from the purchases table

#### Scenario: Refunded redeemer's balance is restored
- **WHEN** a redemption record is deleted via refund
- **THEN** the redeemer's token balance (approved hours minus remaining redemption costs) increases by the refunded record's cost on next computation

### Requirement: Referral payouts cannot be refunded
The system SHALL NOT permit refunding a redemption record whose cost is zero (a referral payout), regardless of how the request is made.

#### Scenario: No refund control shown for referral payouts
- **WHEN** an admin views a purchase row with `cost === 0`
- **THEN** no refund button is rendered for that row

#### Scenario: Server rejects a refund request for a referral payout
- **WHEN** a refund request is made for a redemption record whose stored cost is `0`
- **THEN** the server rejects the request without deleting the record

### Requirement: Only admins can refund purchases
The refund action SHALL be restricted to users identified as admins. Reviewers and any other authenticated role SHALL NOT be permitted to refund a purchase.

#### Scenario: Non-admin request is rejected
- **WHEN** an authenticated user who is not an admin (including a reviewer) requests a refund
- **THEN** the server rejects the request with a forbidden response and does not delete the record

#### Scenario: Unauthenticated request is rejected
- **WHEN** a request to refund a purchase is made without a valid session
- **THEN** the server rejects the request as unauthenticated and does not delete the record

### Requirement: Admins cannot refund their own purchases
The system SHALL prevent an admin from refunding a redemption record whose associated email matches the admin's own identity email, even if the request is made directly against the API.

#### Scenario: Self-refund is blocked
- **WHEN** an admin requests a refund for a redemption record whose stored email matches their own identity email
- **THEN** the server rejects the request and does not delete the record
