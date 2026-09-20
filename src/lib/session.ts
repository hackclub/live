import { createHash } from "node:crypto";
import { EncryptJWT, jwtDecrypt } from "jose";

const SESSION_COOKIE = "session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type SessionPayload = {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  hackatime_access_token?: string;
};

// A256GCM requires exactly a 32-byte key; SESSION_SECRET can be any length,
// so it's hashed down to a fixed-size key rather than used directly.
function getSessionKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set");
  }
  return createHash("sha256").update(secret).digest();
}

// Session payload is exactly the OAuth tokens — nothing else is ever stored
// server-side, so there is no session record/table/KV to keep in sync. It
// carries tokens from both the HCA identity hop and the separate Hackatime
// hop, merged into one cookie so every route only needs one session read.
export async function encryptSession(payload: SessionPayload): Promise<string> {
  const key = getSessionKey();
  return new EncryptJWT({ ...payload })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .encrypt(key);
}

export async function decryptSession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const key = getSessionKey();
    const { payload } = await jwtDecrypt(token, key);
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  name: SESSION_COOKIE,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};

export { SESSION_COOKIE };
