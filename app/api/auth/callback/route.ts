import { NextResponse } from "next/server";
import { exchangeCodeForTokens } from "../../../../src/lib/hackclub";
import { getHackclubRedirectUri, getRequestOrigin } from "../../../../src/lib/origin";
import { encryptSession, sessionCookieOptions } from "../../../../src/lib/session";
import {
  clearStateCookie,
  HCA_STATE_COOKIE,
  readCookie,
  statesMatch,
} from "../../../../src/lib/oauthState";

// OAuth callbacks are request-specific and set cookies; never cache them.
export const revalidate = 0;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const origin = getRequestOrigin(request);

  if (!statesMatch(url.searchParams.get("state"), readCookie(request, HCA_STATE_COOKIE))) {
    const response = NextResponse.redirect(`${origin}/?error=invalid_state`);
    clearStateCookie(response, HCA_STATE_COOKIE);
    return response;
  }

  if (error || !code) {
    const response = NextResponse.redirect(`${origin}/?error=${encodeURIComponent(error || "missing_code")}`);
    clearStateCookie(response, HCA_STATE_COOKIE);
    return response;
  }

  const tokens = await exchangeCodeForTokens({ code, redirectUri: getHackclubRedirectUri(request) });

  if (!tokens?.access_token) {
    const response = NextResponse.redirect(`${origin}/?error=token_exchange_failed`);
    clearStateCookie(response, HCA_STATE_COOKIE);
    return response;
  }

  const session = await encryptSession({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
  });

  // HCA identity and Hackatime are separate OAuth providers with separate
  // tokens — chain straight into the second authorization hop rather than
  // landing on /dashboard without it.
  const response = NextResponse.redirect(`${origin}/api/auth/hackatime/login`);
  response.cookies.set(sessionCookieOptions.name, session, sessionCookieOptions);
  clearStateCookie(response, HCA_STATE_COOKIE);
  return response;
}
