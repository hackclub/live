import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// First-touch referral capture. When a visitor lands on any page with
// `?ref=<github-handle>`, stash the handle in a cookie (once — later `?ref`
// values are ignored) and strip the param from the URL. The cookie is read
// after login in app/api/auth/hackatime/callback to bind the referee.
//
// Kept self-contained per the Proxy guidance (no shared app modules): the
// cookie name and handle pattern mirror src/lib/referral.ts.
const REF_COOKIE = "ref_handle";
const REF_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const HANDLE_RE = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?!-)){0,38}$/;

function isPlausibleGithubUsername(value: string): boolean {
  return HANDLE_RE.test(value) && !value.endsWith("-");
}

export function proxy(request: NextRequest) {
  const ref = request.nextUrl.searchParams.get("ref");
  if (ref === null) return NextResponse.next();

  const cleanUrl = request.nextUrl.clone();
  cleanUrl.searchParams.delete("ref");

  const response = NextResponse.redirect(cleanUrl, 307);

  const alreadySet = request.cookies.has(REF_COOKIE);
  if (!alreadySet && isPlausibleGithubUsername(ref)) {
    response.cookies.set(REF_COOKIE, ref, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: REF_COOKIE_MAX_AGE,
    });
  }

  return response;
}

export const config = {
  // Every page route; skip API, Next internals, and anything with a file
  // extension (static assets in /public).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
