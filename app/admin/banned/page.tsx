import { redirect } from "next/navigation";
import { getSession } from "../../../src/lib/auth";
import { isAdminEmail } from "../../../src/lib/admin";
import { getIdentity } from "../../../src/lib/hackclub";
import { BANNED_USER_FIELDS, listBannedUsers } from "../../../src/lib/airtable";
import BannedUsersTable, { type BannedUserRow } from "../../components/admin/BannedUsersTable";

export const dynamic = "force-dynamic";

export default async function AdminBannedPage() {
  const session = await getSession();
  if (!session?.access_token) redirect("/api/auth/login");

  const identity = await getIdentity(session.access_token);
  if (!identity?.primary_email || !isAdminEmail(identity.primary_email)) {
    redirect("/");
  }

  const records = await listBannedUsers();
  const rows: BannedUserRow[] = records.map((record) => ({
    id: record.id,
    email: String(record.fields[BANNED_USER_FIELDS.email] ?? ""),
    bannedAt: String(record.fields[BANNED_USER_FIELDS.bannedAt] ?? ""),
    bannedBy: String(record.fields[BANNED_USER_FIELDS.bannedBy] ?? ""),
    reason: String(record.fields[BANNED_USER_FIELDS.reason] ?? ""),
  }));

  return (
    <section className="w-4/6 mx-auto min-h-screen py-10 flex flex-col gap-6">
      <div className="flex items-baseline gap-4">
        <p className="text-4xl">banned users.</p>
        <a href="/admin" className="link opacity-70">
          ← review queue
        </a>
      </div>
      <div className="stats stats-vertical sm:stats-horizontal bg-base-200 shadow">
        <div className="stat">
          <div className="stat-title">Total banned</div>
          <div className="stat-value">{rows.length}</div>
        </div>
      </div>
      <BannedUsersTable rows={rows} />
    </section>
  );
}
