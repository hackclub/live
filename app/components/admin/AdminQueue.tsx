"use client";

import { useState } from "react";
import MessageThread, { type ThreadMessage } from "../dashboard/MessageThread";

export type AdminSubmissionRow = {
  id: string;
  hackatimeId: string;
  telescreenLink?: string;
  codeUrl: string;
  playableUrl: string;
  lapseLinks: string;
  hackatimeProjects: string;
  description: string;
  hours: number;
  screenshotUrl: string | null;
  approved: boolean;
  reviewStatus: string;
  messages: ThreadMessage[];
  duplicateRecordIds: string[];
  duplicateHasApproved: boolean;
};

const FILTERS = ["Pending", "Approved", "Rejected", "Fraud"] as const;
type Filter = (typeof FILTERS)[number];

export default function AdminQueue({
  rows,
  filter,
  showTelescreenLink = true,
}: {
  rows: AdminSubmissionRow[];
  filter: Filter;
  showTelescreenLink?: boolean;
}) {
  const [rejectDraft, setRejectDraft] = useState<Record<string, string>>({});
  const [approveMessageDraft, setApproveMessageDraft] = useState<Record<string, string>>({});
  const [hoursDraft, setHoursDraft] = useState<Record<string, string>>({});
  const [justificationDraft, setJustificationDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function act(
    recordId: string,
    action: "approve" | "reject" | "fraud" | "hours",
    extra?: Record<string, unknown>,
  ) {
    const message =
      action === "reject"
        ? rejectDraft[recordId]?.trim()
        : action === "approve"
          ? approveMessageDraft[recordId]?.trim() || undefined
          : undefined;
    if (action === "reject" && !message) return;

    setBusy(recordId);
    try {
      const res = await fetch("/api/admin/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId, action, message, ...extra }),
      });
      if (res.ok) {
        window.location.reload();
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="tabs tabs-boxed w-fit">
        {FILTERS.map((f) => (
          <a key={f} href={`/admin?status=${f}`} className={`tab ${filter === f ? "tab-active" : ""}`}>
            {f}
          </a>
        ))}
      </div>

      {rows.length === 0 && <p className="opacity-60">No submissions in this view.</p>}

      {rows.map((row) => {
        const hoursValue = hoursDraft[row.id] ?? String(row.hours);
        const parsedHours = Number(hoursValue);
        const hoursValid = Number.isFinite(parsedHours) && parsedHours >= 0;
        const hoursChanged =
          hoursValid && Math.round(parsedHours * 10) / 10 !== Math.round(row.hours * 10) / 10;

        return (
        <div key={row.id} className="card bg-base-200 p-4 gap-3">
          {row.duplicateRecordIds.length > 0 && (
            <div className="alert alert-warning py-2 text-sm">
              {row.duplicateHasApproved
                ? "⚠ Code URL already approved on another submission"
                : "⚠ Duplicate Code URL — shared with another submission"}
              {" "}({row.duplicateRecordIds.join(", ")})
            </div>
          )}
          <div className="flex gap-4 items-start flex-wrap">
            {row.screenshotUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.screenshotUrl} alt="" className="w-32 h-32 object-cover rounded-lg" />
            )}
            <div className="flex flex-col gap-1 text-sm">
              {showTelescreenLink && row.telescreenLink && (
                <a className="link" href={row.telescreenLink} target="_blank" rel="noreferrer">
                  Telescreen Link
                </a>
              )}
              <a className="link" href={row.codeUrl} target="_blank" rel="noreferrer">
                Code URL
              </a>
              <a className="link" href={row.playableUrl} target="_blank" rel="noreferrer">
                Playable URL
              </a>
              {row.lapseLinks && <p>Lapse: {row.lapseLinks}</p>}
              {row.hackatimeProjects && <p>Project: {row.hackatimeProjects}</p>}
              {row.hackatimeId && <p>Hackatime ID: {row.hackatimeId}</p>}
              {row.description && <p className="max-w-md whitespace-pre-wrap">Description: {row.description}</p>}
              <p className="opacity-60">
                {row.approved ? "Approved" : row.reviewStatus}
              </p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            <label className="text-sm opacity-70">Hours</label>
            <input
              type="number"
              step="0.1"
              min="0"
              className="input input-bordered input-sm w-24"
              value={hoursValue}
              onChange={(e) => setHoursDraft((d) => ({ ...d, [row.id]: e.target.value }))}
            />
            <span className="text-xs opacity-60">
              stored: {Math.round(row.hours * 10) / 10}h
            </span>
            <button
              className="btn btn-sm"
              disabled={busy === row.id || !hoursValid || !hoursChanged}
              onClick={() => act(row.id, "hours", { hours: parsedHours })}
            >
              Save hours
            </button>
            <textarea
              className="textarea textarea-bordered textarea-sm flex-1 min-w-48"
              placeholder="Override justification (optional)..."
              rows={2}
              value={justificationDraft[row.id] ?? ""}
              onChange={(e) => setJustificationDraft((d) => ({ ...d, [row.id]: e.target.value }))}
            />
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            <button
              className="btn btn-success btn-sm"
              disabled={busy === row.id || !hoursValid}
              onClick={() =>
                act(row.id, "approve", {
                  hours: parsedHours,
                  justification: justificationDraft[row.id]?.trim() || undefined,
                })
              }
            >
              Approve
            </button>
            <input
              className="input input-bordered input-sm flex-1 min-w-48"
              placeholder="Approval message (optional)..."
              value={approveMessageDraft[row.id] ?? ""}
              onChange={(e) => setApproveMessageDraft((d) => ({ ...d, [row.id]: e.target.value }))}
            />
            <input
              className="input input-bordered input-sm flex-1 min-w-48"
              placeholder="Rejection message..."
              value={rejectDraft[row.id] ?? ""}
              onChange={(e) => setRejectDraft((d) => ({ ...d, [row.id]: e.target.value }))}
            />
            <button
              className="btn btn-warning btn-sm"
              disabled={busy === row.id || !rejectDraft[row.id]?.trim()}
              onClick={() => act(row.id, "reject")}
            >
              Reject + message
            </button>
            <button
              className="btn btn-error btn-sm"
              disabled={busy === row.id}
              onClick={() => act(row.id, "fraud")}
            >
              🚩 Fraud
            </button>
          </div>

          <details>
            <summary className="cursor-pointer text-sm opacity-70">Messages</summary>
            <div className="pt-2">
              <MessageThread messages={row.messages} />
            </div>
          </details>
        </div>
        );
      })}
    </div>
  );
}
