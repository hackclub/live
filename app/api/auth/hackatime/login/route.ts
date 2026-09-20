import { NextResponse } from "next/server";
import { HACKATIME_OAUTH_SCOPE } from "../../../../../src/lib/hackatime";
import { getHackatimeRedirectUri } from "../../../../../src/lib/origin";
import {
  createState,
  HACKATIME_STATE_COOKIE,
  setStateCookie,
} from "../../../../../src/lib/oauthState";

// Each login creates a fresh state cookie; never cache this redirect.
export const revalidate = 0;

export async function GET(request: Request) {
  const state = createState();
  const params = new URLSearchParams({
    client_id: process.env.HACKATIME_CLIENT_UID!,
    redirect_uri: getHackatimeRedirectUri(request),
    response_type: "code",
    scope: HACKATIME_OAUTH_SCOPE,
    state,
  });

  const response = NextResponse.redirect(`https://hackatime.hackclub.com/oauth/authorize?${params}`);
  setStateCookie(response, HACKATIME_STATE_COOKIE, state);
  return response;
}
