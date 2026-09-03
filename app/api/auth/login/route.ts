import { NextResponse } from "next/server";
import { HACKCLUB_OAUTH_SCOPE } from "../../../../src/lib/hackclub";
import { getHackclubRedirectUri } from "../../../../src/lib/origin";

export async function GET(request: Request) {
  const params = new URLSearchParams({
    client_id: process.env.OAUTH_CLIENT_ID!,
    redirect_uri: getHackclubRedirectUri(request),
    response_type: "code",
    scope: HACKCLUB_OAUTH_SCOPE,
    // Force HCA to re-show the consent screen instead of silently reusing an
    // earlier authorization — otherwise a user who approved the old
    // (name/email/verification_status) grant keeps getting a token without
    // the `address` / `birthdate` scopes.
    prompt: "consent",
  });

  return NextResponse.redirect(`https://auth.hackclub.com/oauth/authorize?${params}`);
}
