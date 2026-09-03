const HACKCLUB_AUTH_BASE = "https://auth.hackclub.com";

// `address` and `birthdate` are HQ-Official-tier scopes on auth.hackclub.com
// (hackclub/auth app/models/oauth_scope.rb). This app's OAuth client is on
// that tier, so we request them and autofill the submitter's mailing address
// and date of birth from the identity instead of asking for them in the form.
export const HACKCLUB_OAUTH_SCOPE = "name email verification_status address birthdate";

export type HackclubTokens = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

// The `/api/v1/me` identity. `address` and `birthdate` only appear once the
// matching scopes are granted. The exact shape of `address` isn't pinned yet
// (see openspec change add-oauth-identity-autofill, task 1.1) — it may be an
// OIDC-style object, a flat object, or an array of either, so it's typed
// loosely here and normalized by `mapIdentityAddress`.
export type HackclubIdentity = {
  id: string;
  first_name?: string;
  last_name?: string;
  primary_email?: string;
  verification_status?: string;
  ysws_eligible?: boolean;
  birthdate?: string;
  address?: unknown;
  addresses?: unknown;
};

export type MappedAddress = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  zip: string;
};

export async function exchangeCodeForTokens({
  code,
  redirectUri,
}: {
  code: string;
  redirectUri: string;
}): Promise<HackclubTokens | null> {
  const response = await fetch(`${HACKCLUB_AUTH_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.OAUTH_CLIENT_ID!,
      client_secret: process.env.OAUTH_CLIENT_SECRET!,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) return null;
  return response.json();
}

// Returns { id, first_name, last_name, primary_email, ... } or null.
// See auth.hackclub.com/api-docs for the full shape.
export async function getIdentity(accessToken: string): Promise<HackclubIdentity | null> {
  const response = await fetch(`${HACKCLUB_AUTH_BASE}/api/v1/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    console.error("[hackclub] /api/v1/me failed", response.status, await response.text());
    return null;
  }
  const data = await response.json();
  const identity = data.identity ?? null;

  // TEMP DIAGNOSTIC (openspec add-oauth-identity-autofill, task 1.1/1.2):
  // dump the ENTIRE raw /api/v1/me response, pretty-printed and untruncated,
  // so we can see exactly which key holds the date of birth. Remove once tuned.
  console.log(
    "\n===== [hackclub][DIAG] RAW /api/v1/me response BEGIN =====\n" +
      JSON.stringify(data, null, 2) +
      "\n===== [hackclub][DIAG] RAW /api/v1/me response END =====\n",
  );

  if (!identity) return null;

  // Defensive: if HCA returns address / birthdate / verification fields as
  // siblings of `identity` (OIDC-style top-level claims) rather than inside
  // it, fold them in so the mapper/predicates can see them either way.
  for (const key of ["address", "addresses", "birthdate", "verification_status", "ysws_eligible"] as const) {
    if (identity[key] === undefined && data[key] !== undefined) {
      identity[key] = data[key];
    }
  }
  return identity;
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

// Normalizes whatever `/api/v1/me` returns for the mailing address into the
// six Airtable-bound fields, or `null` when a required component is missing.
//
// Handles the shapes we might see (finalize against a live response — task
// 1.1): an OIDC `address` claim object ({ street_address, locality, region,
// postal_code, country }), a flat custom object ({ line_1/line_2/city/... }),
// or an array of either (pick the one flagged primary, else the first).
// A `street_address` that arrives as one newline-joined string is split on
// the first newline into line 1 / line 2.
export function mapIdentityAddress(identity: HackclubIdentity | null): MappedAddress | null {
  if (!identity) return null;

  const raw = identity.address ?? identity.addresses;
  let addr: Record<string, unknown> | null = null;
  if (Array.isArray(raw)) {
    const list = raw.filter((entry): entry is Record<string, unknown> =>
      Boolean(entry) && typeof entry === "object",
    );
    addr = list.find((entry) => entry.primary === true || entry.is_primary === true) ?? list[0] ?? null;
  } else if (raw && typeof raw === "object") {
    addr = raw as Record<string, unknown>;
  }
  if (!addr) return null;

  let line1 = firstString(
    addr.line_1,
    addr.line1,
    addr.address_line_1,
    addr.addressLine1,
    addr.street_address,
    addr.street,
  );
  let line2 = firstString(
    addr.line_2,
    addr.line2,
    addr.address_line_2,
    addr.addressLine2,
    addr.extended_address,
  );

  // OIDC `street_address` may pack multiple lines into one \n-joined string.
  if (!line2 && line1.includes("\n")) {
    const [first, ...rest] = line1.split("\n");
    line1 = first.trim();
    line2 = rest.join(", ").trim();
  }

  const city = firstString(addr.city, addr.locality, addr.town);
  const state = firstString(addr.state, addr.region, addr.province, addr.state_province);
  const country = firstString(addr.country, addr.country_code, addr.countryCode);
  const zip = firstString(addr.zip, addr.zip_code, addr.postal_code, addr.postalCode, addr.postcode);

  if (!line1 || !city || !state || !country || !zip) return null;

  return { addressLine1: line1, addressLine2: line2, city, state, country, zip };
}

// Normalizes an HCA `birthdate` to `YYYY-MM-DD` (the value an <input
// type="date"> and the Airtable Birthday field both expect), or `null` if it
// can't be parsed. OIDC birthdate is already `YYYY-MM-DD`.
export function normalizeBirthdate(birthdate: string | undefined | null): string | null {
  if (!birthdate) return null;
  const trimmed = birthdate.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

// A submitter may only submit once their HCA identity is verified AND carries
// a full mailing address AND a parseable date of birth. The "verified" check
// is deliberately permissive here — tune it against real `verification_status`
// / `ysws_eligible` values (task 1.2).
export function isIdentityVerified(identity: HackclubIdentity | null): boolean {
  if (!identity) return false;
  if (identity.ysws_eligible === true) return true;
  return /verified|eligible/i.test(identity.verification_status ?? "");
}

export function isIdentityCompleteForSubmission(identity: HackclubIdentity | null): boolean {
  const verified = isIdentityVerified(identity);
  const address = mapIdentityAddress(identity);
  const birthday = normalizeBirthdate(identity?.birthdate);
  const complete = verified && address !== null && birthday !== null;

  // TEMP DIAGNOSTIC (task 1.2): when the check fails, log exactly which of the
  // three sub-checks failed and the raw values behind them. Remove once tuned.
  if (!complete) {
    console.log("[hackclub][DIAG] identity NOT complete for submission:", {
      verified,
      hasAddress: address !== null,
      hasBirthday: birthday !== null,
      verification_status: identity?.verification_status ?? null,
      ysws_eligible: identity?.ysws_eligible ?? null,
      rawAddress: identity?.address ?? identity?.addresses ?? null,
      rawBirthdate: identity?.birthdate ?? null,
    });
  }
  return complete;
}
