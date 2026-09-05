## MODIFIED Requirements

### Requirement: HCA login initiates OAuth authorization
The system SHALL redirect an unauthenticated user who starts login to `auth.hackclub.com`'s OAuth authorize endpoint, requesting the `name email verification_status address birthdate` scope. The `address` and `birthdate` scopes provide the submitter's mailing address and date of birth for the submission flow; this app's OAuth client is entitled to them.

#### Scenario: User starts login
- **WHEN** an unauthenticated user visits the login route
- **THEN** the system redirects them to `auth.hackclub.com/oauth/authorize` with `client_id`, `redirect_uri`, and scope `name email verification_status address birthdate`

#### Scenario: Existing session predates the wider scope
- **WHEN** a user whose session was issued before `address`/`birthdate` were requested loads a page that needs the address or birthdate
- **THEN** the system treats that identity as incomplete and routes the user back through the login route to re-consent under the current scope

## ADDED Requirements

### Requirement: Identity exposes mailing address and date of birth
The system SHALL read the submitter's mailing address components (address line 1, optional address line 2, city, state/province, country, ZIP/postal code) and date of birth from the HCA identity returned by `/api/v1/me`, and SHALL expose a single mapping that returns the normalized address or `null` when any required component is absent.

#### Scenario: Identity includes a complete address and birthdate
- **WHEN** the identity from `/api/v1/me` contains a mailing address with all required components and a parseable `birthdate`
- **THEN** the mapping returns the normalized address object and the birthdate in `YYYY-MM-DD` form

#### Scenario: Identity is missing an address component
- **WHEN** the identity omits any required address component (e.g. no postal code or no country)
- **THEN** the mapping returns `null` and the identity is considered incomplete for submission

#### Scenario: Identity carries multiple addresses
- **WHEN** the identity returns more than one mailing address
- **THEN** the system selects the primary address (or the first when none is marked primary) and ignores the rest
