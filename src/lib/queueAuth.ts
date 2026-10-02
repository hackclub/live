import { getSessionFromRequest } from "./auth";
import { isAdminEmail, isReviewerEmail } from "./admin";
import { getIdentity } from "./hackclub";

// Admins and reviewers may read queue data; everyone else gets null.
export async function requireQueueAccess(request: Request): Promise<boolean> {
  const session = await getSessionFromRequest(request);
  if (!session?.access_token) return false;
  const identity = await getIdentity(session.access_token);
  const email = identity?.primary_email;
  return Boolean(email && (isAdminEmail(email) || isReviewerEmail(email)));
}

export const RECORD_ID_PATTERN = /^rec[A-Za-z0-9]{10,}$/;
