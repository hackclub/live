## ADDED Requirements

### Requirement: Per-status hour and project totals
The `/admin` dashboard SHALL display, for the full submission set (not scoped to the currently selected status tab), the total `Optional - Override Hours Spent` and the total project count for each of: approved, rejected, and fraud.

A submission SHALL count as approved when its `Approved` field is `TRUE`, regardless of its `Review Status` value. A submission SHALL count as rejected when `Review Status` equals `'Rejected'`. A submission SHALL count as fraud when `Review Status` equals `'Fraud'`.

#### Scenario: Mixed submissions produce correct per-status totals
- **WHEN** the submission set contains 3 records with `Approved=TRUE` (hours 2, 3, 5), 2 records with `Review Status='Rejected'` (hours 1, 4), and 1 record with `Review Status='Fraud'` (hours 10)
- **THEN** the dashboard shows Approved hours = 10 and Approved projects = 3, Rejected hours = 5 and Rejected projects = 2, Fraud hours = 10 and Fraud projects = 1

#### Scenario: Record with no numeric hours does not contribute to any hour total
- **WHEN** a record's `Optional - Override Hours Spent` field is missing or non-numeric
- **THEN** that record contributes 0 to whichever status hour total it belongs to, but still contributes 1 to that status's project count

### Requirement: Unreviewed hours exclude reviewed-but-unjustified records
The dashboard SHALL compute "unreviewed hours" as the sum of `Optional - Override Hours Spent` across records where `Approved = FALSE`, `Review Status` is `'Pending'` or empty, AND `Optional - Override Hours Spent Justification` is empty.

#### Scenario: Reviewed record missing a justification is not counted as unreviewed
- **WHEN** a record has `Review Status = 'Fraud'` and an empty `Optional - Override Hours Spent Justification`
- **THEN** its hours are NOT included in the unreviewed hours total (it is excluded by the `Review Status` check even though the justification is empty)

#### Scenario: Pending record without a justification is counted as unreviewed
- **WHEN** a record has `Approved = FALSE`, `Review Status = 'Pending'`, and an empty justification
- **THEN** its hours ARE included in the unreviewed hours total

### Requirement: Percent approved
The dashboard SHALL display a percent-approved value computed as approved project count divided by the sum of approved, rejected, and fraud project counts. Pending/unreviewed submissions SHALL NOT be included in this denominator.

#### Scenario: Percent approved computed from reviewed submissions only
- **WHEN** there are 6 approved, 3 rejected, 1 fraud, and 20 still-pending submissions
- **THEN** percent approved displays as 6 / (6+3+1) = 60%, unaffected by the 20 pending submissions

#### Scenario: No submissions reviewed yet
- **WHEN** approved, rejected, and fraud project counts are all 0
- **THEN** the dashboard displays a placeholder (e.g. "—") instead of dividing by zero

### Requirement: Review progress indicator
The dashboard SHALL display a progress indicator showing how many of all submissions have been reviewed (approved + rejected + fraud) out of the total submission count, including a count of how many remain to be reviewed.

#### Scenario: Progress bar reflects reviewed vs total
- **WHEN** there are 47 total submissions and 10 have been reviewed (any of approved/rejected/fraud)
- **THEN** the progress indicator shows a fill of 10/47 and a label indicating 37 more submissions need review
