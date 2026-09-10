"use client";

import { Fragment, useEffect, useState } from "react";

export type PurchaseRow = {
  id: string;
  firstName: string;
  githubUsername: string;
  itemName: string;
  cost: number;
  quantity: number;
  redeemedAt: string;
  referralId: string | null;
};

type Snapshot = { submissions: { id: string; project: string; hours: number }[]; totalHours: number };

function SnapshotPanel({ redemptionId }: { redemptionId: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/purchases/snapshot?redemptionId=${redemptionId}`);
        if (!res.ok) {
          if (!cancelled) setError("Couldn't load snapshot.");
          return;
        }
        const data = await res.json();
        if (!cancelled) setSnapshot(data);
      } catch {
        if (!cancelled) setError("Network error.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [redemptionId]);

  if (loading) return <p className="text-sm opacity-60 p-3">loading snapshot…</p>;
  if (error) return <p className="text-sm text-error p-3">{error}</p>;
  if (!snapshot || snapshot.submissions.length === 0) {
    return (
      <p className="text-sm opacity-60 p-3">
        No approved submissions before this purchase — balance snapshot is empty.
      </p>
    );
  }

  return (
    <div className="p-3 text-sm">
      <p className="opacity-60 mb-2">
        Approved submissions as of this purchase (approximate — not a precise historical
        balance):
      </p>
      <ul className="flex flex-col gap-1">
        {snapshot.submissions.map((s) => (
          <li key={s.id} className="flex justify-between font-mono">
            <span className="truncate pr-4">{s.project || "(untitled project)"}</span>
            <span>{s.hours.toFixed(1)}h</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 font-bold">Total: {snapshot.totalHours.toFixed(1)}h</p>
    </div>
  );
}

export default function PurchasesTable({ rows }: { rows: PurchaseRow[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (rows.length === 0) {
    return <p className="opacity-60 text-sm">No redemptions yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Redeemer</th>
            <th>Item</th>
            <th>Quantity</th>
            <th>Total cost</th>
            <th>Redeemed</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Fragment key={row.id}>
              <tr id={row.id}>
                <td>
                  {row.firstName || "?"}{" "}
                  {row.githubUsername && <span className="opacity-60">@{row.githubUsername}</span>}
                </td>
                <td>{row.itemName}</td>
                <td>{row.quantity}</td>
                <td>{row.cost} hours</td>
                <td>{row.redeemedAt ? new Date(row.redeemedAt).toLocaleString() : "—"}</td>
                <td className="flex gap-3 items-center justify-end">
                  {row.referralId && (
                    <a href={`/admin/referrals#${row.referralId}`} className="link text-xs opacity-70">
                      referral →
                    </a>
                  )}
                  <button
                    className="btn btn-xs"
                    onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                  >
                    {expanded === row.id ? "hide" : "snapshot"}
                  </button>
                </td>
              </tr>
              {expanded === row.id && (
                <tr>
                  <td colSpan={6} className="bg-base-200">
                    <SnapshotPanel redemptionId={row.id} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
