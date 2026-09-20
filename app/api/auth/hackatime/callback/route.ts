import { NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../../src/lib/auth";
import { REFERRAL_SOURCE } from "../../../../../src/lib/airtable";
import { exchangeHackatimeCodeForToken } from "../../../../../src/lib/hackatime";
import { getIdentity } from "../../../../../src/lib/hackclub";
import { getHackatimeRedirectUri, getRequestOrigin } from "../../../../../src/lib/origin";
import { bindReferral, REF_COOKIE } from "../../../../../src/lib/referral";
import { encryptSession, sessionCookieOptions } from "../../../../../src/lib/session";
import {
  clearStateCookie,
  HACKATIME_STATE_COOKIE,
  readCookie,
  statesMatch,
} from "../../../../../src/lib/oauthState";

// OAuth callbacks are request-specific and set cookies; never cache them.
export const revalidate = 0;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const origin = getRequestOrigin(request);

  if (!statesMatch(url.searchParams.get("state"), readCookie(request, HACKATIME_STATE_COOKIE))) {
    const response = NextResponse.redirect(`${origin}/?error=invalid_state`);
    clearStateCookie(response, HACKATIME_STATE_COOKIE);
    return response;
  }

  if (error || !code) {
    const response = NextResponse.redirect(`${origin}/?error=${encodeURIComponent(error || "missing_code")}`);
    clearStateCookie(response, HACKATIME_STATE_COOKIE);
    return response;
  }

  // This hop only makes sense after the HCA identity hop already ran and set
  // a session cookie — if it's missing, restart from the top.
  const existingSession = await getSessionFromRequest(request);
  if (!existingSession) {
    const response = NextResponse.redirect(`${origin}/api/auth/login`);
    clearStateCookie(response, HACKATIME_STATE_COOKIE);
    return response;
  }

  const tokens = await exchangeHackatimeCodeForToken({
    code,
    redirectUri: getHackatimeRedirectUri(request),
  });

  if (!tokens?.access_token) {
    const response = NextResponse.redirect(`${origin}/?error=hackatime_token_exchange_failed`);
    clearStateCookie(response, HACKATIME_STATE_COOKIE);
    return response;
  }

  const session = await encryptSession({
    ...existingSession,
    hackatime_access_token: tokens.access_token,
  });

  const response = NextResponse.redirect(`${origin}/dashboard`);
  response.cookies.set(sessionCookieOptions.name, session, sessionCookieOptions);
  clearStateCookie(response, HACKATIME_STATE_COOKIE);

  // First-touch referral bind: if the visitor arrived via `/?ref=<handle>`,
  // attach them to that referrer now (they're freshly authenticated and have
  // not submitted anything yet). Never let this block the redirect.
  const refHandle = readCookie(request, REF_COOKIE);

  if (refHandle) {
    response.cookies.set(REF_COOKIE, "", { path: "/", maxAge: 0 });
    try {
      const identity = await getIdentity(existingSession.access_token);
      if (identity?.primary_email) {
        await bindReferral({
          refereeEmail: identity.primary_email,
          handle: refHandle,
          source: REFERRAL_SOURCE.link,
        });
      }
    } catch (err) {
      console.error("[referral] link bind after hackatime callback failed", err);
    }
  }

  return response;
}
