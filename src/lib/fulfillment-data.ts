// Server-side loader for the admin fulfillment dashboard: four bulk reads
// (redemptions, submissions, referrals, Unified) plus HCB, joined into the
// plain inputs the pure functions in fulfillment.ts work on.
import {
  listAllRedemptions,
  listAllReferrals,
  listSubmissions,
  REDEMPTION_FIELDS,
  REFERRAL_FIELDS,
  SUBMISSION_FIELDS,
} from "./airtable";
import { getHcbBalance } from "./hcb";
import { listLiveUnifiedProjects, unifiedRecordUrl, type UnifiedProject } from "./unified-airtable";
import {
  normalizeCodeUrl,
  normalizeEmail,
  type ProjectView,
  type RedemptionInput,
  type UserInput,
} from "./fulfillment";

// One full-table scan covers both display identity (any submission) and
// earned hours (approved ones). fields[] keeps address/birthday in Airtable.
const SUBMISSION_SCAN_FIELDS = [
  SUBMISSION_FIELDS.email,
  SUBMISSION_FIELDS.firstName,
  SUBMISSION_FIELDS.githubUsername,
  SUBMISSION_FIELDS.approved,
  SUBMISSION_FIELDS.overrideHours,
  SUBMISSION_FIELDS.codeUrl,
  SUBMISSION_FIELDS.playableUrl,
  SUBMISSION_FIELDS.hackatimeProjects,
];

// Normalized Code URL -> Unified record, for "in Unified" badges and links.
export function indexUnifiedByCodeUrl(unified: UnifiedProject[] | null): Map<string, UnifiedProject> | null {
  if (!unified) return null;
  const index = new Map<string, UnifiedProject>();
  for (const project of unified) {
    if (project.codeUrl) index.set(normalizeCodeUrl(project.codeUrl), project);
  }
  return index;
}

export function toProjectView(
  record: { id: string; fields: Record<string, unknown> },
  unifiedByCodeUrl: Map<string, UnifiedProject> | null,
): ProjectView {
  const codeUrl = String(record.fields[SUBMISSION_FIELDS.codeUrl] ?? "");
  const match = codeUrl ? unifiedByCodeUrl?.get(normalizeCodeUrl(codeUrl)) : undefined;
  return {
    id: record.id,
    project: String(record.fields[SUBMISSION_FIELDS.hackatimeProjects] ?? ""),
    hours: Number(record.fields[SUBMISSION_FIELDS.overrideHours] ?? 0) || 0,
    codeUrl,
    playableUrl: String(record.fields[SUBMISSION_FIELDS.playableUrl] ?? ""),
    inUnified: Boolean(match),
    unifiedUrl: match ? unifiedRecordUrl(match.id) : null,
  };
}

export async function loadFulfillmentData() {
  const [redemptionRecords, submissions, referrals, unified, hcb] = await Promise.all([
    listAllRedemptions(),
    listSubmissions(undefined, SUBMISSION_SCAN_FIELDS),
    listAllReferrals(),
    listLiveUnifiedProjects(),
    getHcbBalance(),
  ]);

  // redemption record id -> referral record id, for referral payouts.
  const referralByRedemptionId = new Map<string, string>();
  for (const referral of referrals) {
    const linked = referral.fields[REFERRAL_FIELDS.redemption];
    const redemptionId = Array.isArray(linked) ? linked[0] : undefined;
    if (typeof redemptionId === "string") referralByRedemptionId.set(redemptionId, referral.id);
  }

  const redemptions: RedemptionInput[] = redemptionRecords.map((record) => {
    const fulfilledAt = record.fields[REDEMPTION_FIELDS.fulfilledAt];
    return {
      id: record.id,
      email: normalizeEmail(String(record.fields[REDEMPTION_FIELDS.email] ?? "")),
      itemName: String(record.fields[REDEMPTION_FIELDS.itemName] ?? "") || "(unnamed item)",
      cost: Number(record.fields[REDEMPTION_FIELDS.cost] ?? 0) || 0,
      redeemedAt: String(record.fields[REDEMPTION_FIELDS.redeemedAt] ?? record.createdTime ?? ""),
      fulfilledAt: typeof fulfilledAt === "string" && fulfilledAt ? fulfilledAt : null,
      referralId: referralByRedemptionId.get(record.id) ?? null,
    };
  });

  const unifiedByCodeUrl = indexUnifiedByCodeUrl(unified);
  const unifiedHoursByEmail = new Map<string, number>();
  for (const project of unified ?? []) {
    const email = normalizeEmail(project.email);
    unifiedHoursByEmail.set(email, (unifiedHoursByEmail.get(email) ?? 0) + project.hours);
  }

  // Per email: first identity seen, plus approved projects.
  const identityByEmail = new Map<string, { firstName: string; githubUsername: string }>();
  const projectsByEmail = new Map<string, ProjectView[]>();
  let pendingHours = 0;
  for (const record of submissions) {
    const email = normalizeEmail(String(record.fields[SUBMISSION_FIELDS.email] ?? ""));
    if (!email) continue;
    const firstName = String(record.fields[SUBMISSION_FIELDS.firstName] ?? "");
    const githubUsername = String(record.fields[SUBMISSION_FIELDS.githubUsername] ?? "");
    const known = identityByEmail.get(email);
    if (!known || (!known.firstName && !known.githubUsername)) {
      identityByEmail.set(email, { firstName, githubUsername });
    }
    if (record.fields[SUBMISSION_FIELDS.approved] !== true) continue;
    const project = toProjectView(record, unifiedByCodeUrl);
    if (!project.inUnified) pendingHours += project.hours;
    const list = projectsByEmail.get(email) ?? [];
    list.push(project);
    projectsByEmail.set(email, list);
  }

  const redeemerEmails = Array.from(new Set(redemptions.map((r) => r.email)));
  const users: UserInput[] = redeemerEmails.map((email) => {
    const projects = projectsByEmail.get(email) ?? [];
    return {
      email,
      firstName: identityByEmail.get(email)?.firstName ?? "",
      githubUsername: identityByEmail.get(email)?.githubUsername ?? "",
      localHours: projects.reduce((sum, p) => sum + p.hours, 0),
      unifiedHours: unified === null ? null : (unifiedHoursByEmail.get(email) ?? 0),
      projects,
    };
  });

  return {
    users,
    redemptions,
    financeInputs: {
      hcbCents: hcb?.cents ?? null,
      hcbFetchedAt: hcb?.fetchedAt ?? null,
      unifiedTotalHours: unified === null ? null : unified.reduce((sum, p) => sum + p.hours, 0),
      pendingHours: unified === null ? null : pendingHours,
    },
    unifiedAvailable: unified !== null,
  };
}
