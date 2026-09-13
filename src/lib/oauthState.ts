import { randomBytes, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";

export const HCA_STATE_COOKIE = "hca_oauth_state";
export const HACKATIME_STATE_COOKIE = "hackatime_oauth_state";

const STATE_MAX_AGE_SECONDS = 600;

export function createState(): string {
  return randomBytes(32).toString("base64url");
}

export function stateCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: STATE_MAX_AGE_SECONDS,
  };
}

export function setStateCookie(response: NextResponse, name: string, value: string): void {
  response.cookies.set(name, value, stateCookieOptions());
}

export function clearStateCookie(response: NextResponse, name: string): void {
  response.cookies.set(name, "", { path: "/", maxAge: 0 });
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  const match = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!match) return null;
  try {
    return decodeURIComponent(match.slice(name.length + 1));
  } catch {
    return null;
  }
}

export function statesMatch(actual: string | null, expected: string | null): boolean {
  if (!actual || !expected) return false;
  const actualBuf = Buffer.from(actual);
  const expectedBuf = Buffer.from(expected);
  if (actualBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(actualBuf, expectedBuf);
}
