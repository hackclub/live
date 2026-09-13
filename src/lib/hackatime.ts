const HACKATIME_BASE = "https://hackatime.hackclub.com";

// profile covers GitHub username access; read covers the projects/hours
// endpoints.
export const HACKATIME_OAUTH_SCOPE = "profile read";

export type HackatimeTokens = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

export type HackatimeMe = {
  github_username?: string;
};

export type HackatimeProject = {
  name: string;
  total_seconds: number;
  most_recent_heartbeat?: string;
  languages?: string[];
  archived?: boolean;
};

export async function exchangeHackatimeCodeForToken({
  code,
  redirectUri,
}: {
  code: string;
  redirectUri: string;
}): Promise<HackatimeTokens | null> {
  const response = await fetch(`${HACKATIME_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.HACKATIME_CLIENT_UID!,
      client_secret: process.env.HACKATIME_SECRET!,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    console.error("[hackatime] token exchange failed", response.status);
    return null;
  }
  return response.json();
}

export async function getHackatimeMe(accessToken: string): Promise<HackatimeMe | null> {



  const response = await fetch(`${HACKATIME_BASE}/api/v1/authenticated/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    console.error("[hackatime] /me failed", response.status);
    return null;
  }
  const data = await response.json();
  return data?.data ?? data ?? null;
}

// The exact response envelope for this endpoint hasn't been verified live
// (see design.md Open Questions) — several shapes have been seen across
// Hackatime-integrating projects (bare array, {data: [...]}, {projects:
// [...]}, {data: {projects: [...]}}). Rather than crash with "X.filter is
// not a function" when the guess is wrong, this normalizes every shape it
// knows about and logs the raw payload once when none match, so the actual
// shape can be read from server logs and this list extended.
export async function getHackatimeProjects(accessToken: string): Promise<HackatimeProject[]> {
  


   
  const response = await fetch(`${HACKATIME_BASE}/api/v1/authenticated/projects`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    console.error("[hackatime] /projects failed", response.status);
    return [];
  }

  const data = await response.json();
  const candidates: unknown[] = [
    data,
    data?.data,
    data?.projects,
    data?.data?.projects,
    data?.trust_factor?.projects,
  ];
  const projects = candidates.find((candidate) => Array.isArray(candidate));

  if (!projects) {
    console.error(
      "[hackatime] /projects returned an unrecognized shape, treating as empty:",
      JSON.stringify(data).slice(0, 2000),
    );
    return [];
  }

  return projects as HackatimeProject[];
}

export function trackedHoursForProject(project: HackatimeProject): number {
  return project.total_seconds / 3600;
}
