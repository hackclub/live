import { NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../../src/lib/auth";
import { REFERRAL_SOURCE } from "../../../../../src/lib/airtable";
import { exchangeHackatimeCodeForToken } from "../../../../../src/lib/hackatime";
import { getIdentity } from "../../../../../src/lib/hackclub";
import { getHackatimeRedirectUri, getRequestOrigin } from "../../../../../src/lib/origin";
import { bindReferral, REF_COOKIE } from "../../../../../src/lib/referral";
import { encryptSession, sessionCookieOptions } from "../../../../../src/lib/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const origin = getRequestOrigin(request);

  if (error || !code) {
    return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(error || "missing_code")}`);
  }

  // This hop only makes sense after the HCA identity hop already ran and set
  // a session cookie — if it's missing, restart from the top.
  const existingSession = await getSessionFromRequest(request);
  if (!existingSession) {
    return NextResponse.redirect(`${origin}/api/auth/login`);
  }

  const tokens = await exchangeHackatimeCodeForToken({
    code,
    redirectUri: getHackatimeRedirectUri(request),
  });

  if (!tokens?.access_token) {
    return NextResponse.redirect(`${origin}/?error=hackatime_token_exchange_failed`);
  }

  const session = await encryptSession({
    ...existingSession,
    hackatime_access_token: tokens.access_token,
  });

  const response = NextResponse.redirect(`${origin}/dashboard`);
  response.cookies.set(sessionCookieOptions.name, session, sessionCookieOptions);

  // First-touch referral bind: if the visitor arrived via `/?ref=<handle>`,
  // attach them to that referrer now (they're freshly authenticated and have
  // not submitted anything yet). Never let this block the redirect.
  const refHandle = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${REF_COOKIE}=`))
    ?.slice(REF_COOKIE.length + 1);

  if (refHandle) {
    response.cookies.set(REF_COOKIE, "", { path: "/", maxAge: 0 });
    try {
      const identity = await getIdentity(existingSession.access_token);
      if (identity?.primary_email) {
        await bindReferral({
          refereeEmail: identity.primary_email,
          handle: decodeURIComponent(refHandle),
          source: REFERRAL_SOURCE.link,
        });
      }
    } catch (err) {
      console.error("[referral] link bind after hackatime callback failed", err);
    }
  }

  return response;
}
