// Hardcoded allowlist rather than a roles table/field — simplest thing that
// satisfies "admin users (me)". Extend this array to add more admins.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

// Separate allowlist for the restricted reviewer role — scoped access to
// non-PII fields, no operational controls (timer, etc).
const REVIEWER_EMAILS = (process.env.REVIEWER_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export function isReviewerEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return REVIEWER_EMAILS.includes(email.toLowerCase());
}
