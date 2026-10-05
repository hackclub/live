"use client";

import { useState } from "react";

type PlanRow = {
  email: string;
  earned: number;
  spent: number;
  balanceBefore: number;
  balanceAfter: number;
  flag: "overspent" | "high_hours" | null;
};

type Plan = {
  rows: PlanRow[];
  refundableCount: number;
  keptCount: number;
  totalRefunded: number;
  totalEarned: number;
  badHours: string[];
  duplicateCodeUrls: { url: string; emails: string[] }[];
  backup: unknown[];
};

const CONFIRM_PHRASE = "REFUND ALL";
const fmt = (n: number) => (Math.round(n * 100) / 100).toString();

export default function RefundAllPanel() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ deleted: number; failed: number; remaining: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadPlan() {
    setLoading(true);
    setError(null);
    setProgress(null);
    setDownloaded(false);
    setPhrase("");
    try {
      const res = await fetch("/api/admin/purchases/refund-all");
      if (!res.ok) {
        setError("Couldn't build the refund preview.");
        return;
      }
      setPlan(await res.json());
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  function downloadBackup() {
    if (!plan) return;
    const blob = new Blob([JSON.stringify(plan.backup, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `redemptions-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setDownloaded(true);
  }

  async function runRefund() {
    setRunning(true);
    setError(null);
    let deleted = 0;
    let failed = 0;
    try {
      // The server deletes a small batch per call; loop until nothing is left
      // (or a whole batch fails, so we don't spin forever).
      for (;;) {
        const res = await fetch("/api/admin/purchases/refund-all", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirm: phrase }),
        });
        if (!res.ok) {
          setError("Refund stopped: server rejected a batch. Reload the preview and retry.");
          break;
        }
        const batch: { deleted: number; failed: number; remaining: number } = await res.json();
        deleted += batch.deleted;
        failed += batch.failed;
        setProgress({ deleted, failed, remaining: batch.remaining });
        if (batch.remaining === 0 || batch.deleted === 0) break;
      }
    } catch {
      setError("Network error — refund stopped partway. Reload the preview to see what's left.");
    } finally {
      setRunning(false);
    }
  }

  const done = progress !== null && progress.remaining === 0;

  return (
    <div className="border border-error/40 rounded-box p-4 flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <p className="text-xl">refund everyone</p>
        <button className="btn btn-sm" onClick={loadPlan} disabled={loading || running}>
          {loading ? "loading…" : plan ? "reload preview" : "preview"}
        </button>
      </div>
      <p className="text-sm opacity-70">
        Deletes every purchase with a cost (referral rewards stay), so each person&apos;s balance becomes exactly
        their approved submission hours. Pause the shop first.
      </p>
      {error && <p className="text-sm text-error">{error}</p>}

      {plan && (
        <>
          <div className="stats stats-vertical sm:stats-horizontal bg-base-200">
            <div className="stat">
              <div className="stat-title">Purchases to refund</div>
              <div className="stat-value">{plan.refundableCount}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Hours refunded</div>
              <div className="stat-value">{fmt(plan.totalRefunded)}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Hours outstanding after</div>
              <div className="stat-value">{fmt(plan.totalEarned)}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Referral rows kept</div>
              <div className="stat-value">{plan.keptCount}</div>
            </div>
          </div>

          {plan.badHours.length > 0 && (
            <div className="text-sm text-warning">
              <p>Approved records with missing/invalid hours (counted as 0):</p>
              <ul className="font-mono">
                {plan.badHours.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          )}
          {plan.duplicateCodeUrls.length > 0 && (
            <div className="text-sm text-warning">
              <p>Code URLs approved more than once (possible double-credited hours):</p>
              <ul className="font-mono">
                {plan.duplicateCodeUrls.map((d) => (
                  <li key={d.url}>
                    {d.url}: {d.emails.join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="table table-xs">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Earned</th>
                  <th>Spent</th>
                  <th>Balance now</th>
                  <th>Balance after</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {plan.rows.map((r) => (
                  <tr key={r.email}>
                    <td>{r.email || "(no email)"}</td>
                    <td>{fmt(r.earned)}</td>
                    <td>{fmt(r.spent)}</td>
                    <td className={r.balanceBefore < 0 ? "text-error" : ""}>{fmt(r.balanceBefore)}</td>
                    <td>{fmt(r.balanceAfter)}</td>
                    <td className="text-warning">
                      {r.flag === "overspent" && "was overspent"}
                      {r.flag === "high_hours" && "high hours"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {done ? (
            <p className="text-success">
              Done: refunded {progress.deleted} purchases{progress.failed ? ` (${progress.failed} failed — reload the preview)` : ""}.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <button className="btn btn-sm" onClick={downloadBackup} disabled={running}>
                  1. download backup ({plan.backup.length} rows)
                </button>
              </div>
              <div className="flex items-center gap-3">
                <input
                  className="input input-sm input-bordered"
                  placeholder={`type ${CONFIRM_PHRASE}`}
                  value={phrase}
                  onChange={(e) => setPhrase(e.target.value)}
                  disabled={!downloaded || running}
                />
                <button
                  className="btn btn-sm btn-error"
                  disabled={!downloaded || phrase !== CONFIRM_PHRASE || running || plan.refundableCount === 0}
                  onClick={runRefund}
                >
                  {running
                    ? `refunding… ${progress ? `${progress.deleted} done, ${progress.remaining} left` : ""}`
                    : "2. refund everyone"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
