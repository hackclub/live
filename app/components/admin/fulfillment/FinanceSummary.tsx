import { PAYOUT_USD_PER_HOUR, REVENUE_USD_PER_HOUR, type Finances } from "../../../../src/lib/fulfillment";
import { hrs, usd } from "./format";

export default function FinanceSummary({
  finances,
  headlineUsd,
  stale,
}: {
  finances: Finances;
  // Pinned to the server-rendered value — see FulfillmentDashboard.
  headlineUsd: number | null;
  stale: boolean;
}) {
  const shortfall = headlineUsd !== null && headlineUsd < 0;
  return (
    <div className="border border-base-300 rounded-box p-4 flex flex-col gap-3">
      <p className="text-xl">finances</p>
      <p className="text-sm opacity-70">
        Payouts cost {usd(PAYOUT_USD_PER_HOUR)}/hr. Revenue is {usd(REVENUE_USD_PER_HOUR)}/hr, paid per approved hour that
        lands in Unified. The headline assumes we pay for overage ourselves and counts no pending Unified revenue.
      </p>
      <div className="stats stats-vertical lg:stats-horizontal bg-base-200">
        <div className="stat">
          <div className="stat-title">HCB balance</div>
          <div className="stat-value">{finances.hcbUsd === null ? "?" : usd(finances.hcbUsd)}</div>
          <div className="stat-desc">
            {finances.hcbFetchedAt
              ? `as of ${new Date(finances.hcbFetchedAt).toLocaleTimeString()}`
              : "couldn't reach HCB"}
          </div>
        </div>
        <div className="stat">
          <div className="stat-title">Unfulfilled</div>
          <div className="stat-value">{usd(finances.unfulfilledUsd)}</div>
          <div className="stat-desc">{hrs(finances.unfulfilledHours)} still owed</div>
        </div>
        <div className="stat">
          <div className="stat-title">{shortfall ? "Shortfall" : "HCB − unfulfilled"}</div>
          <div className={`stat-value ${shortfall ? "text-error" : "text-success"}`}>
            {headlineUsd === null ? "?" : usd(Math.abs(headlineUsd))}
          </div>
          <div className="stat-desc">
            {stale ? "reload to refresh after fulfilling" : "self-funding overage"}
          </div>
        </div>
      </div>
      <div className="stats stats-vertical lg:stats-horizontal bg-base-200">
        <div className="stat">
          <div className="stat-title">Revenue earned</div>
          <div className="stat-value text-2xl">
            {finances.revenueEarnedUsd === null ? "?" : usd(finances.revenueEarnedUsd)}
          </div>
          <div className="stat-desc">Unified hours × {usd(REVENUE_USD_PER_HOUR)}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Pending revenue</div>
          <div className="stat-value text-2xl">
            {finances.pendingRevenueUsd === null ? "?" : usd(finances.pendingRevenueUsd)}
          </div>
          <div className="stat-desc">local-only projects · informational, not counted</div>
        </div>
        <div className="stat">
          <div className="stat-title">Overage exposure</div>
          <div className="stat-value text-2xl text-warning">{usd(finances.overageHours * PAYOUT_USD_PER_HOUR)}</div>
          <div className="stat-desc">
            {hrs(finances.overageHours)} · ~{hrs(finances.overageUnfulfilledHours)} unfulfilled (estimate)
          </div>
        </div>
        <div className="stat">
          <div className="stat-title">Exploit exposure</div>
          <div className="stat-value text-2xl text-error">{usd(finances.exploitHours * PAYOUT_USD_PER_HOUR)}</div>
          <div className="stat-desc">
            {hrs(finances.exploitHours)} · ~{hrs(finances.exploitUnfulfilledHours)} unfulfilled (estimate)
          </div>
        </div>
      </div>
    </div>
  );
}
