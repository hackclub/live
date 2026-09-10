import {
  createBannedUser,
  deleteBannedUser,
  getBannedUserByEmail,
} from "./airtable";

// Async and Airtable-backed, unlike the env-var isAdminEmail/isReviewerEmail
// allowlists in ./admin.ts — a ban list is mutable at runtime, so it can't
// be a sync check. Every enforcement point (dashboard, redeem, submit,
// shop/redeem) calls this so "banned" never drifts between surfaces.
export async function isEmailBanned(email: string): Promise<boolean> {
  if (!email) return false;
  const record = await getBannedUserByEmail(email);
  return record !== null;
}

export async function banEmail(email: string, bannedBy: string, reason?: string): Promise<void> {
  const existing = await getBannedUserByEmail(email);
  if (existing) return; // already banned — idempotent
  await createBannedUser({ email, bannedBy, reason });
}

export async function unbanEmail(email: string): Promise<void> {
  const existing = await getBannedUserByEmail(email);
  if (!existing) return;
  await deleteBannedUser(existing.id);
}
