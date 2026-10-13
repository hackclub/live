# Spec Delta

## Purpose

Tells admins whether the Live YSWS HCB balance can cover every purchase still waiting to be fulfilled, assuming we pay for overage ourselves, and how much of that money is at risk from overage and exploit spending.

## ADDED Requirements

### Requirement: Two distinct hour rates
The finance summary SHALL value redeemed (payout) hours at $5.00 per hour and Unified-backed revenue at $8.50 per hour. The two rates SHALL be labelled on the page.

#### Scenario: Rates displayed
- **WHEN** an admin views the finance summary
- **THEN** it states that payouts are $5.00/hr and revenue is $8.50/hr per Unified hour

### Requirement: HCB balance shown
The summary SHALL show the current balance of the `live-ysws-v2` HCB organization. If HCB cannot be reached, it SHALL show the balance as unknown and mark balance-derived figures unknown, but still render the rest of the page.

#### Scenario: HCB unreachable
- **WHEN** the HCB API request fails
- **THEN** the balance and "HCB − unfulfilled" show `?` and the fulfillment sections still render

### Requirement: Unfulfilled payout and headline budget
The summary SHALL show total unfulfilled hours and their payout value (hours × $5.00). As its headline figure, it SHALL show the HCB balance minus that payout value, labelled as assuming overage is self-funded, and highlighted as a shortfall when negative.

#### Scenario: Current data
- **WHEN** the HCB balance is $3,246.68 and 409.0 unfulfilled hours remain
- **THEN** unfulfilled payout is $2,045.00 and the headline shows $1,201.68

#### Scenario: Shortfall
- **WHEN** unfulfilled payout exceeds the HCB balance
- **THEN** the headline is labelled a shortfall and styled as an error

### Requirement: Revenue figures
The summary SHALL show revenue earned (total Live Unified hours × $8.50) and pending revenue (approved local hours not matched to Unified × $8.50). Pending revenue SHALL be labelled informational and SHALL NOT be added to the headline budget.

#### Scenario: Pending revenue excluded
- **WHEN** pending revenue is $1,753
- **THEN** the headline budget value is the same as if pending revenue were $0

### Requirement: Overage and exploit exposure
The summary SHALL show overage exposure (hours spent beyond Unified but within local approval, across all users) and exploit exposure (hours spent beyond local approval). Each SHALL show total hours, their payout value, and the estimated unfulfilled portion, labelled as an estimate.

#### Scenario: Unfulfilled portion estimated
- **WHEN** a user spent 52h, has 48h local, and 10h of purchases are unfulfilled
- **THEN** 4h of their unfulfilled purchases count toward unfulfilled exploit exposure, and up to the remaining 6h count toward unfulfilled overage exposure, limited by their overage hours

### Requirement: Figures refresh after fulfillment
After an admin fulfills or unfulfills a line, the unfulfilled hours, unfulfilled payout and unfulfilled exposure figures SHALL update without a full page reload. The headline budget SHALL NOT change until the page reloads with a fresh HCB balance, because paying out lowers the real balance with a delay.

#### Scenario: Fulfill updates unfulfilled payout
- **WHEN** an admin fulfills a 30h line
- **THEN** unfulfilled payout drops by $150.00 immediately

#### Scenario: Headline waits for HCB
- **WHEN** an admin fulfills a line
- **THEN** the headline keeps its previous value and is marked as needing a refresh until the page reloads

### Requirement: Balance timestamp shown
The summary SHALL show when the HCB balance was fetched.

#### Scenario: Cached balance
- **WHEN** the HCB balance was fetched four minutes ago
- **THEN** the summary shows the fetch time next to the balance
