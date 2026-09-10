"use client";

import { Fragment, useEffect, useState } from "react";

export type PurchaseRow = {
  id: string;
  firstName: string;
  githubUsername: string;
  itemName: string;
  cost: number;
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

export default function PurchasesTable({ rows: initialRows }: { rows: PurchaseRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [refunding, setRefunding] = useState<string | null>(null);
  const [refundError, setRefundError] = useState<{ id: string; message: string } | null>(null);

  if (rows.length === 0) {
    return <p className="opacity-60 text-sm">No redemptions yet.</p>;
  }

  async function handleRefund(row: PurchaseRow) {
    if (!confirm(`Refund "${row.itemName}" for ${row.firstName || row.githubUsername || "this redeemer"}? This cannot be undone.`)) {
      return;
    }
    setRefundError(null);
    setRefunding(row.id);
    try {
      const res = await fetch("/api/admin/purchases/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: row.id }),
      });
      if (!res.ok) {
        setRefundError({ id: row.id, message: "Refund failed." });
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch {
      setRefundError({ id: row.id, message: "Network error." });
    } finally {
      setRefunding(null);
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Redeemer</th>
            <th>Item</th>
            <th>Cost</th>
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
                <td>{row.cost}</td>
                <td>{row.redeemedAt ? new Date(row.redeemedAt).toLocaleString() : "—"}</td>
                <td className="flex flex-col items-end gap-1">
                  <div className="flex gap-3 items-center justify-end">
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
                    {row.cost > 0 && (
                      <button
                        className="btn btn-xs btn-error"
                        disabled={refunding === row.id}
                        onClick={() => handleRefund(row)}
                      >
                        {refunding === row.id ? "refunding…" : "refund"}
                      </button>
                    )}
                  </div>
                  {refundError?.id === row.id && (
                    <p className="text-xs text-error">{refundError.message}</p>
                  )}
                </td>
              </tr>
              {expanded === row.id && (
                <tr>
                  <td colSpan={5} className="bg-base-200">
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
