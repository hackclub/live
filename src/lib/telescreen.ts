const TELESCREEN_BASE = "https://telescreen.hackclub.com/workbench/hackatime/overview";

// Opens the submitter's Hackatime overview already filtered to the submitted
// project, e.g. ...overview?u=892&p=sprint.
export function telescreenLink(hackatimeId: string, project?: string): string {
  const params = new URLSearchParams({ u: hackatimeId });
  const name = project?.trim();
  if (name) params.set("p", name);
  return `${TELESCREEN_BASE}?${params.toString()}`;
}

// Adds the Telescreen link to a justification once — it's what carries the
// evidence along in the Airtable record that gets pushed to Unified.
export function withTelescreenLink(justification: string, link: string): string {
  const base = justification.trim();
  if (base.includes(link)) return base;
  return base ? `${base}\n${link}` : link;
}
