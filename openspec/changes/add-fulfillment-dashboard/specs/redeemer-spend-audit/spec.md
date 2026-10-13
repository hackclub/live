# Spec Delta

## Purpose

Shows admins whether each redeemer's spending is backed by projects already in the Unified YSWS database, only by locally approved projects, or by nothing at all, so overspending and unfunded payouts are caught before fulfillment.

## ADDED Requirements

### Requirement: Unified records scoped to Live
The system SHALL read approved projects from the Unified YSWS "Approved Projects" table, configured by `UNIFIED_PAT`, `UNIFIED_APP_NAME` and `UNIFIED_TABLE_NAME`. Only records whose YSWS name is exactly `Live` SHALL be considered.

#### Scenario: Another YSWS with a similar name
- **WHEN** Unified contains a record whose YSWS name is `Lively`
- **THEN** that record is not counted toward any Live user's Unified hours

#### Scenario: Unified not configured or unreachable
- **WHEN** the Unified env vars are missing or the Unified request fails
- **THEN** the dashboard still renders fulfillment data, shows that Unified data is unavailable, and does not classify any user as OVERAGE or OK

### Requirement: Per-user hour totals
For each redeemer, the system SHALL compute spent hours (sum of Redemptions cost), local hours (sum of override hours across their approved Live submissions), and Unified hours (sum of Hours Spent across their Live Unified records). Emails are matched case-insensitively and trimmed.

#### Scenario: Totals shown
- **WHEN** an admin views a user section
- **THEN** it shows spent, Unified and local hours for that user

### Requirement: Spend classification
Each redeemer SHALL be classified as **EXPLOIT** if spent hours exceed local hours by any amount. Otherwise they are **OVERAGE** if spent hours exceed Unified hours, and **OK** if not. The classification SHALL be shown as a badge on the user section.

#### Scenario: Overspent by a tenth of an hour
- **WHEN** a user spent 7.5h and has 7.4h approved locally
- **THEN** they are classified EXPLOIT

#### Scenario: Spent hours not yet in Unified
- **WHEN** a user spent 43h, has 44.6h approved locally and 8h in Unified
- **THEN** they are classified OVERAGE

#### Scenario: Fully backed by Unified
- **WHEN** a user spent 30h and has 30h in Unified
- **THEN** they are classified OK

### Requirement: Exploit list
The dashboard SHALL show, above the user sections, a list of every EXPLOIT user with their spent hours, local hours, and the amount overspent. Each entry SHALL link to that user's section.

#### Scenario: No exploiters
- **WHEN** no user is classified EXPLOIT
- **THEN** the list area states that no one has overspent

### Requirement: Project Unified status
Each approved local project for a redeemer SHALL be marked "in Unified" when a Live Unified record has the same Code URL, compared after trimming whitespace and removing trailing slashes, and "local only" otherwise.

#### Scenario: Trailing slash difference
- **WHEN** the local Code URL is `https://github.com/a/b/` and the Unified one is `https://github.com/a/b`
- **THEN** the project is marked "in Unified"

### Requirement: Project links in snapshot
The per-redemption snapshot SHALL list each project with its hours, its Unified status, and links to its code URL and playable URL when present. A matched project SHALL also link to its Unified Airtable record. Links SHALL open in a new tab.

#### Scenario: Matched project
- **WHEN** an admin opens the snapshot for a purchase whose user has a project in Unified
- **THEN** that project shows a link of the form `https://airtable.com/<unified base>/<unified table>/<record id>`

#### Scenario: Local-only project
- **WHEN** a project has no Unified match
- **THEN** it shows the "local only" badge and its code/playable links but no Unified link

### Requirement: No personal data leaves the server beyond display needs
Snapshot and dashboard responses SHALL NOT include addresses, birthdays or other submission PII. They include only the email-derived grouping, display identity, project names, hours and links.

#### Scenario: Snapshot payload
- **WHEN** the snapshot API returns project data
- **THEN** the payload contains no address or birthday fields
