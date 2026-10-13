import type { ProjectView, UserInput } from "../../../../src/lib/fulfillment";

export const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
export const hrs = (n: number) => `${Math.round(n * 10) / 10}h`;

export function displayName(user: Pick<UserInput, "firstName" | "githubUsername" | "email">): string {
  return user.firstName || (user.githubUsername ? `@${user.githubUsername}` : user.email || "(no email)");
}

// Hackatime project names are often blank; fall back to the repo path.
export function projectLabel(project: Pick<ProjectView, "project" | "codeUrl">): string {
  if (project.project) return project.project;
  try {
    const path = new URL(project.codeUrl).pathname.split("/").filter(Boolean);
    if (path.length) return path.slice(0, 2).join("/");
  } catch {
    // Not a URL — fall through to the placeholder.
  }
  return "(untitled project)";
}

// Stable DOM id for a user card, so the exploit list can link to it.
export const userAnchor = (email: string) => `u-${email.replace(/[^a-z0-9]/g, "-")}`;
