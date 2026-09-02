"use client";

import { useState } from "react";
import MessageThread, { type ThreadMessage } from "../dashboard/MessageThread";
import type { WorkLogType } from "../../../src/lib/submission";

export type AdminSubmissionRow = {
  id: string;
  telescreenLink: string;
  codeUrl: string;
  playableUrl: string;
  lapseLinks: string;
  workLogType: WorkLogType;
  screenshotUrl: string | null;
  approved: boolean;
  reviewStatus: string;
  messages: ThreadMessage[];
};

const FILTERS = ["Pending", "Approved", "Rejected", "Fraud"] as const;
type Filter = (typeof FILTERS)[number];

export default function AdminQueue({
  rows,
  filter,
}: {
  rows: AdminSubmissionRow[];
  filter: Filter;
}) {
  const [rejectDraft, setRejectDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function act(recordId: string, action: "approve" | "reject" | "fraud") {
    const message = action === "reject" ? rejectDraft[recordId]?.trim() : undefined;
    if (action === "reject" && !message) return;

    setBusy(recordId);
    try {
      const res = await fetch("/api/admin/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId, action, message }),
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

      {rows.map((row) => (
        <div key={row.id} className="card bg-base-200 p-4 gap-3">
          <div className="flex gap-4 items-start flex-wrap">
            {row.screenshotUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.screenshotUrl} alt="" className="w-32 h-32 object-cover rounded-lg" />
            )}
            <div className="flex flex-col gap-1 text-sm">
              <a className="link" href={row.telescreenLink} target="_blank" rel="noreferrer">
                Telescreen Link
              </a>
              <a className="link" href={row.codeUrl} target="_blank" rel="noreferrer">
                Code URL
              </a>
              <a className="link" href={row.playableUrl} target="_blank" rel="noreferrer">
                Playable URL
              </a>
              {row.lapseLinks && <p>{row.workLogType}: {row.lapseLinks}</p>}
              <p className="opacity-60">
                {row.approved ? "Approved" : row.reviewStatus}
              </p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            <button
              className="btn btn-success btn-sm"
              disabled={busy === row.id}
              onClick={() => act(row.id, "approve")}
            >
              Approve
            </button>
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
      ))}
    </div>
  );
}
