import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, decryptSession, type SessionPayload } from "./session";

// For Server Components/pages: reads the session cookie via next/headers.
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  return decryptSession(cookieStore.get(SESSION_COOKIE)?.value);
}

// For Server Components/pages that require auth: redirects instead of
// returning null, so callers don't need to handle the unauthenticated case.
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session?.access_token) {
    redirect("/api/auth/login");
  }
  if (!session.hackatime_access_token) {
    redirect("/api/auth/hackatime/login");
  }
  return session;
}

// For Route Handlers: reads the session cookie from the incoming request
// directly, returning null instead of redirecting.
export async function getSessionFromRequest(request: Request): Promise<SessionPayload | null> {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (!match) return null;
  let value: string;
  try {
    value = decodeURIComponent(match.slice(SESSION_COOKIE.length + 1));
  } catch {
    return null;
  }
  return decryptSession(value);
}
