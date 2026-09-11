## ADDED Requirements

### Requirement: Reviewer records a precheck verdict without triggering payout
A reviewer (or admin) SHALL be able to submit a verdict of "approve" or "reject" for a pending submission, together with a justification and a deflated hours figure, via a `precheck` action that writes only to `Reviewer Verdict`, `Reviewer Justification`, `Reviewer Hours`, `Reviewer Reviewed By`, and `Reviewer Reviewed At`. This action SHALL NOT modify `Approved`, `Review Status`, `Override Hours`, `Override Hours Justification`, `Reviewed By`, or `Reviewed At`, and SHALL NOT trigger referral payout.

#### Scenario: Reviewer prechecks an approval
- **WHEN** a reviewer submits `precheck` with `verdict: "approve"`, a justification, and deflated hours for a pending submission
- **THEN** the submission's `Reviewer Verdict`, `Reviewer Justification`, `Reviewer Hours`, `Reviewer Reviewed By`, and `Reviewer Reviewed At` are written
- **AND** `Approved` remains `false`
- **AND** `Review Status` remains unchanged
- **AND** no referral payout is triggered

#### Scenario: Reviewer prechecks a rejection
- **WHEN** a reviewer submits `precheck` with `verdict: "reject"`, a justification, and deflated hours for a pending submission
- **THEN** the submission's `Reviewer Verdict`, `Reviewer Justification`, `Reviewer Hours`, `Reviewer Reviewed By`, and `Reviewer Reviewed At` are written
- **AND** `Review Status` remains unchanged (not set to `Rejected`)

#### Scenario: Reviewer cannot precheck their own submission
- **WHEN** a reviewer submits `precheck` for a submission whose email matches their own identity
- **THEN** the request is rejected with `cannot_review_own_submission`, consistent with the existing self-review restriction on approve/reject/fraud

### Requirement: Only admins can flag fraud
The `fraud` action on the review API SHALL be restricted to identities where `isAdminEmail` is true. A reviewer identity (where `isAdminEmail` is false) SHALL receive a `forbidden` response when attempting the `fraud` action.

#### Scenario: Reviewer attempts to flag fraud
- **WHEN** an identity that is a reviewer but not an admin calls the API with `action: "fraud"`
- **THEN** the response is `403 forbidden`
- **AND** no fields on the submission are modified

#### Scenario: Admin flags fraud
- **WHEN** an admin identity calls the API with `action: "fraud"`
- **THEN** `Review Status` is set to `Fraud` as today

### Requirement: Reviewer-facing queue offers precheck actions only
The `/review` page SHALL present Approve and Reject controls that invoke the `precheck` action (not the final `approve`/`reject` actions), and SHALL NOT present a Fraud control.

#### Scenario: Reviewer views the queue
- **WHEN** a reviewer (non-admin) loads `/review`
- **THEN** the rendered queue offers precheck Approve and precheck Reject actions
- **AND** no Fraud action is rendered

#### Scenario: Admin views /review
- **WHEN** an admin loads `/review`
- **THEN** the admin still sees only precheck actions on this page (finalization happens from `/admin`)

### Requirement: Admin dashboard surfaces prereviewed submissions for final action
`/admin` SHALL provide a "Prereviewed" queue view containing submissions where `Reviewer Verdict` is set, `Approved` is `false`, and `Review Status` is empty or `Pending`. Each row SHALL display the reviewer's identity (`Reviewer Reviewed By`), their justification (`Reviewer Justification`), their verdict (`Reviewer Verdict`), and their suggested hours (`Reviewer Hours`). The admin's hours and justification inputs for that row SHALL be prefilled from `Reviewer Hours` and `Reviewer Justification` respectively, and SHALL remain editable before the admin takes a final Approve, Reject, or Fraud action.

#### Scenario: Prereviewed row appears after reviewer precheck
- **WHEN** a submission has `Reviewer Verdict` set and has not yet been finalized (`Approved=false`, `Review Status` empty/Pending)
- **THEN** it appears in the `/admin` Prereviewed tab
- **AND** the row shows the reviewer's name, justification, verdict, and suggested hours

#### Scenario: Admin edits prefilled values before finalizing
- **WHEN** an admin opens a prereviewed row whose hours/justification inputs were prefilled from the reviewer's precheck
- **AND** the admin changes the hours value before clicking Approve
- **THEN** the final `Override Hours` written on approval reflects the admin's edited value, not the reviewer's original suggestion

#### Scenario: Row leaves Prereviewed once finalized
- **WHEN** an admin takes a final Approve, Reject, or Fraud action on a prereviewed row
- **THEN** the row no longer appears in the Prereviewed tab (its `Approved`/`Review Status` now reflects the final action)
