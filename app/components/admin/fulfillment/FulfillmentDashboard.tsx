"use client";

import { useMemo, useState } from "react";
import {
  buildUserViews,
  computeFinances,
  type ItemLine,
  type RedemptionInput,
  type UserInput,
  type UserView,
} from "../../../../src/lib/fulfillment";
import FinanceSummary from "./FinanceSummary";
import ExploitList from "./ExploitList";
import UserCard from "./UserCard";

type FinanceInputs = Parameters<typeof computeFinances>[1];

export default function FulfillmentDashboard({
  users,
  initialRedemptions,
  financeInputs,
  initialHeadlineUsd,
  unifiedAvailable,
  adminEmail,
}: {
  users: UserInput[];
  initialRedemptions: RedemptionInput[];
  financeInputs: FinanceInputs;
  initialHeadlineUsd: number | null;
  unifiedAvailable: boolean;
  adminEmail: string;
}) {
  const [redemptions, setRedemptions] = useState(initialRedemptions);
  // Any fulfill/refund makes the pinned headline out of date until reload.
  const [stale, setStale] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Users with something left to fulfill start expanded.
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(buildUserViews(users, initialRedemptions).filter((v) => v.unfulfilledHours > 0).map((v) => v.email)),
  );

  const views = useMemo(() => buildUserViews(users, redemptions), [users, redemptions]);
  const finances = useMemo(() => computeFinances(views, financeInputs), [views, financeInputs]);

  function setLineError(id: string, message: string | null) {
    setErrors((prev) => {
      const next = { ...prev };
      if (message) next[id] = message;
      else delete next[id];
      return next;
    });
  }

  async function handleFulfill(view: UserView, line: ItemLine, fulfilled: boolean) {
    const id = `${view.email}|${line.key}`;
    setLineError(id, null);
    setPending(id);
    try {
      const res = await fetch("/api/admin/purchases/fulfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordIds: line.recordIds, fulfilled }),
      });
      const data: { updated?: string[]; failed?: string[]; error?: string } = await res.json().catch(() => ({}));
      // Only move the rows the server confirmed it wrote.
      const updated = new Set(data.updated ?? []);
      if (updated.size > 0) {
        const now = new Date().toISOString();
        setRedemptions((prev) =>
          prev.map((r) => (updated.has(r.id) ? { ...r, fulfilledAt: fulfilled ? now : null } : r)),
        );
        setStale(true);
      }
      if (data.failed?.length) {
        setLineError(id, `${data.failed.length} of ${line.count} failed to save — retry.`);
      } else if (!res.ok) {
        setLineError(id, data.error === "cannot_fulfill_own_purchase" ? "Can't fulfill your own purchase." : "Save failed.");
      }
    } catch {
      setLineError(id, "Network error.");
    } finally {
      setPending(null);
    }
  }

  // Refunds one record — the newest in the line — through the existing
  // single-record refund route.
  async function handleRefund(view: UserView, line: ItemLine) {
    const recordId = line.recordIds[0];
    const who = view.firstName || view.githubUsername || view.email;
    if (!confirm(`Refund one "${line.itemName}" (${line.cost}h) for ${who}? This cannot be undone.`)) return;
    const id = `${view.email}|${line.key}`;
    setLineError(id, null);
    setPending(id);
    try {
      const res = await fetch("/api/admin/purchases/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId }),
      });
      if (!res.ok) {
        setLineError(id, "Refund failed.");
        return;
      }
      setRedemptions((prev) => prev.filter((r) => r.id !== recordId));
      setStale(true);
    } catch {
      setLineError(id, "Network error.");
    } finally {
      setPending(null);
    }
  }

  function toggle(email: string, force?: boolean) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (force ?? !next.has(email)) next.add(email);
      else next.delete(email);
      return next;
    });
  }

  return (
    <>
      <FinanceSummary finances={finances} headlineUsd={initialHeadlineUsd} stale={stale} />
      {!unifiedAvailable && (
        <div role="alert" className="alert alert-warning text-sm">
          Unified data is unavailable (check UNIFIED_* env vars). Only EXPLOIT can be determined; everyone else shows
          UNKNOWN.
        </div>
      )}
      <ExploitList views={views} onJump={(email) => toggle(email, true)} />
      <div className="flex flex-col gap-3">
        <p className="text-xl">
          users <span className="text-sm opacity-60">({views.length})</span>
        </p>
        {views.length === 0 && <p className="opacity-60 text-sm">No redemptions yet.</p>}
        {views.map((view) => (
          <UserCard
            key={view.email}
            view={view}
            open={expanded.has(view.email)}
            onToggle={() => toggle(view.email)}
            isSelf={view.email === adminEmail}
            actions={{
              pending,
              errors,
              onFulfill: (line, fulfilled) => handleFulfill(view, line, fulfilled),
              onRefund: (line) => handleRefund(view, line),
            }}
          />
        ))}
      </div>
    </>
  );
}
