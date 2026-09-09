import { redirect } from "next/navigation";
import { getSession } from "../../../src/lib/auth";
import { isAdminEmail } from "../../../src/lib/admin";
import { getIdentity } from "../../../src/lib/hackclub";
import {
  listAllRedemptions,
  listAllReferrals,
  resolveDisplayIdentityByEmail,
  REDEMPTION_FIELDS,
  REFERRAL_FIELDS,
} from "../../../src/lib/airtable";
import PurchasesTable, { type PurchaseRow } from "../../components/admin/PurchasesTable";

export const dynamic = "force-dynamic";

export default async function AdminPurchasesPage() {
  const session = await getSession();
  if (!session?.access_token) redirect("/api/auth/login");

  const identity = await getIdentity(session.access_token);
  if (!identity?.primary_email || !isAdminEmail(identity.primary_email)) {
    redirect("/");
  }

  const [redemptions, referrals] = await Promise.all([listAllRedemptions(), listAllReferrals()]);

  // redemption record id -> referral record id, for the ones paid out via referral.
  const referralByRedemptionId = new Map<string, string>();
  for (const referral of referrals) {
    const linked = referral.fields[REFERRAL_FIELDS.redemption];
    const redemptionId = Array.isArray(linked) ? linked[0] : undefined;
    if (redemptionId) referralByRedemptionId.set(redemptionId, referral.id);
  }

  // One identity lookup per distinct email, not per redemption.
  const emails = Array.from(
    new Set(redemptions.map((r) => String(r.fields[REDEMPTION_FIELDS.email] ?? "")).filter(Boolean)),
  );
  const identityByEmail = new Map<string, { firstName: string; githubUsername: string } | null>(
    await Promise.all(
      emails.map(async (email) => [email, await resolveDisplayIdentityByEmail(email)] as const),
    ),
  );

  const rows: PurchaseRow[] = redemptions.map((record) => {
    const email = String(record.fields[REDEMPTION_FIELDS.email] ?? "");
    const identity = identityByEmail.get(email) ?? null;
    const cost = Number(record.fields[REDEMPTION_FIELDS.cost] ?? 0);
    return {
      id: record.id,
      firstName: identity?.firstName ?? "",
      githubUsername: identity?.githubUsername ?? "",
      itemName: String(record.fields[REDEMPTION_FIELDS.itemName] ?? ""),
      cost,
      redeemedAt: String(record.fields[REDEMPTION_FIELDS.redeemedAt] ?? ""),
      referralId: referralByRedemptionId.get(record.id) ?? null,
    };
  });

  const directCount = rows.filter((r) => r.cost > 0).length;
  const referralPayoutCount = rows.filter((r) => r.cost === 0).length;
  const totalHoursSpent = rows.reduce((sum, r) => sum + r.cost, 0);

  return (
    <section className="w-4/6 mx-auto min-h-screen py-10 flex flex-col gap-6">
      <div className="flex items-baseline gap-4">
        <p className="text-4xl">purchases.</p>
        <a href="/admin" className="link opacity-70">
          ← review queue
        </a>
        <a href="/admin/referrals" className="link opacity-70">
          referrals →
        </a>
      </div>
      <div className="stats stats-vertical sm:stats-horizontal bg-base-200 shadow">
        <div className="stat">
          <div className="stat-title">Total redemptions</div>
          <div className="stat-value">{rows.length}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Direct purchases</div>
          <div className="stat-value">{directCount}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Referral payouts</div>
          <div className="stat-value">{referralPayoutCount}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Total hours spent</div>
          <div className="stat-value">{Math.round(totalHoursSpent * 10) / 10}</div>
        </div>
      </div>
      <PurchasesTable rows={rows} />
    </section>
  );
}
