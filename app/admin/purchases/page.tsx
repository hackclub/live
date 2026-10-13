import { redirect } from "next/navigation";
import { getSession } from "../../../src/lib/auth";
import { isAdminEmail } from "../../../src/lib/admin";
import { getIdentity } from "../../../src/lib/hackclub";
import { loadFulfillmentData } from "../../../src/lib/fulfillment-data";
import { buildUserViews, computeFinances, normalizeEmail } from "../../../src/lib/fulfillment";
import RefundAllPanel from "../../components/admin/RefundAllPanel";
import FulfillmentDashboard from "../../components/admin/fulfillment/FulfillmentDashboard";

export default async function AdminPurchasesPage() {
  const session = await getSession();
  if (!session?.access_token) redirect("/api/auth/login");

  const identity = await getIdentity(session.access_token);
  if (!identity?.primary_email || !isAdminEmail(identity.primary_email)) {
    redirect("/");
  }

  const data = await loadFulfillmentData();
  // The headline is computed once here and pinned on the client: fulfilling
  // lowers the real HCB balance only later, so it only moves on reload.
  const initialFinances = computeFinances(buildUserViews(data.users, data.redemptions), data.financeInputs);

  return (
    <section className="w-4/6 mx-auto min-h-screen py-10 flex flex-col gap-6">
      <div className="flex items-baseline gap-4">
        <p className="text-4xl">fulfillment.</p>
        <a href="/admin" className="link opacity-70">
          ← review queue
        </a>
        <a href="/admin/referrals" className="link opacity-70">
          referrals →
        </a>
      </div>
      <FulfillmentDashboard
        users={data.users}
        initialRedemptions={data.redemptions}
        financeInputs={data.financeInputs}
        initialHeadlineUsd={initialFinances.headlineUsd}
        unifiedAvailable={data.unifiedAvailable}
        adminEmail={normalizeEmail(identity.primary_email)}
      />
      <RefundAllPanel />
    </section>
  );
}
