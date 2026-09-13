const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

function normalizeHost(value: string): string {
  return value
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
}

function allowedHosts(): string[] {
  return [
    process.env.SITE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.ALLOWED_HOSTS,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_URL,
  ]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(","))
    .map(normalizeHost)
    .filter(Boolean);
}

// Derives the public origin from request headers rather than the server's
// own bind address, which is wrong behind a proxy (Vercel) or in dev
// containers. This is what makes OAuth redirect URIs work automatically on
// both localhost and every deployed domain without hardcoding anything.
export function getRequestOrigin(request: Request): string {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = normalizeHost(forwardedHost || request.headers.get("host") || "");
  const protocol = forwardedProto || (LOCAL_HOST.test(host) ? "http" : "https");

  if (LOCAL_HOST.test(host) || allowedHosts().includes(host)) {
    return `${protocol}://${host}`;
  }

  const canonical =
    process.env.SITE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${normalizeHost(process.env.VERCEL_PROJECT_PRODUCTION_URL)}`
      : undefined);
  if (canonical) {
    return canonical.replace(/\/$/, "");
  }

  throw new Error(`Refusing to build an origin from untrusted host: ${host}`);
}

export function getHackclubRedirectUri(request: Request): string {
  return `${getRequestOrigin(request)}/api/auth/callback`;
}

export function getHackatimeRedirectUri(request: Request): string {
  return `${getRequestOrigin(request)}/api/auth/hackatime/callback`;
}
