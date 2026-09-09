import { redirect } from "next/navigation";
import { getSession } from "../../../src/lib/auth";
import { isAdminEmail } from "../../../src/lib/admin";
import { getIdentity } from "../../../src/lib/hackclub";
import {
  listAllReferrals,
  listAllRedemptions,
  resolveDisplayIdentityByEmail,
  REDEMPTION_FIELDS,
  REFERRAL_FIELDS,
  REFERRAL_STATUS,
} from "../../../src/lib/airtable";
import ReferralsTable, { type ReferralRow } from "../../components/admin/ReferralsTable";

export const dynamic = "force-dynamic";

export default async function AdminReferralsPage() {
  const session = await getSession();
  if (!session?.access_token) redirect("/api/auth/login");

  const identity = await getIdentity(session.access_token);
  if (!identity?.primary_email || !isAdminEmail(identity.primary_email)) {
    redirect("/");
  }

  const [referrals, redemptions] = await Promise.all([listAllReferrals(), listAllRedemptions()]);
  const costByRedemptionId = new Map(
    redemptions.map((r) => [r.id, Number(r.fields[REDEMPTION_FIELDS.cost] ?? 0)]),
  );

  const emails = Array.from(
    new Set(
      referrals
        .flatMap((r) => [
          String(r.fields[REFERRAL_FIELDS.refereeEmail] ?? ""),
          String(r.fields[REFERRAL_FIELDS.referrerEmail] ?? ""),
        ])
        .filter(Boolean),
    ),
  );
  const identityByEmail = new Map<string, { firstName: string; githubUsername: string } | null>(
    await Promise.all(
      emails.map(async (email) => [email, await resolveDisplayIdentityByEmail(email)] as const),
    ),
  );

  const rows: ReferralRow[] = referrals.map((record) => {
    const refereeEmail = String(record.fields[REFERRAL_FIELDS.refereeEmail] ?? "");
    const referrerEmail = String(record.fields[REFERRAL_FIELDS.referrerEmail] ?? "");
    const referrerHandle = String(record.fields[REFERRAL_FIELDS.referrerHandle] ?? "");
    const refereeIdentity = identityByEmail.get(refereeEmail) ?? null;
    const referrerIdentity = referrerEmail ? identityByEmail.get(referrerEmail) ?? null : null;
    const status = String(record.fields[REFERRAL_FIELDS.status] ?? REFERRAL_STATUS.pending);
    const linkedRedemption = record.fields[REFERRAL_FIELDS.redemption];
    const redemptionId = Array.isArray(linkedRedemption) ? linkedRedemption[0] : undefined;
    return {
      id: record.id,
      referrerFirstName: referrerIdentity?.firstName ?? "",
      referrerHandle,
      refereeFirstName: refereeIdentity?.firstName ?? "",
      refereeHandle: refereeIdentity?.githubUsername ?? "",
      status,
      redemptionId: redemptionId ?? null,
    };
  });

  const total = rows.length;
  const pendingCount = rows.filter((r) => r.status === REFERRAL_STATUS.pending).length;
  const paidCount = rows.filter((r) => r.status === REFERRAL_STATUS.paid).length;
  const voidCount = rows.filter((r) => r.status === REFERRAL_STATUS.void).length;
  const hoursGenerated = rows
    .filter((r) => r.status === REFERRAL_STATUS.paid && r.redemptionId)
    .reduce((sum, r) => sum + (costByRedemptionId.get(r.redemptionId!) ?? 0), 0);

  return (
    <section className="w-4/6 mx-auto min-h-screen py-10 flex flex-col gap-6">
      <div className="flex items-baseline gap-4">
        <p className="text-4xl">referrals.</p>
        <a href="/admin" className="link opacity-70">
          ← review queue
        </a>
        <a href="/admin/purchases" className="link opacity-70">
          purchases →
        </a>
      </div>
      <div className="stats stats-vertical sm:stats-horizontal bg-base-200 shadow">
        <div className="stat">
          <div className="stat-title">Total referrals</div>
          <div className="stat-value">{total}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Pending</div>
          <div className="stat-value">{pendingCount}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Paid</div>
          <div className="stat-value">{paidCount}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Void</div>
          <div className="stat-value">{voidCount}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Hours via payouts</div>
          <div className="stat-value">{Math.round(hoursGenerated * 10) / 10}</div>
        </div>
      </div>
      <ReferralsTable rows={rows} />
    </section>
  );
}
