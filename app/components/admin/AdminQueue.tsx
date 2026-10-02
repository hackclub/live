"use client";

import { useEffect, useState } from "react";
import MessageThread, { type ThreadMessage } from "../dashboard/MessageThread";
import type { UnifiedInfo } from "../../../src/lib/unified";
import { QUEUE_PAGE_SIZE } from "../../../src/lib/submissionSearch";

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
  duplicateRecordIds: string[];
  duplicateHasApproved: boolean;
  isBanned: boolean;
  // Reviewer precheck — set once a reviewer has recorded a non-terminal
  // verdict; never implies Approved/Review Status have changed.
  reviewerVerdict?: "Approve" | "Reject" | null;
  reviewerJustification?: string;
  reviewerHours?: number | null;
  reviewerReviewedBy?: string;
};

const FILTERS = ["Pending", "Prereviewed", "Approved", "Rejected", "Fraud"] as const;
type Filter = (typeof FILTERS)[number];

export default function AdminQueue({
  rows,
  filter,
  query = "",
  limit,
  hasMore,
  total,
  tabs = FILTERS,
  showTelescreenLink = true,
  isAdmin = false,
  // "review" turns Approve/Reject into non-terminal precheck recommendations
  // (justification + deflated hours required, no payout) and hides Fraud.
  variant = "admin",
}: {
  rows: AdminSubmissionRow[];
  filter: Filter;
  // Active search (spans every status when non-empty).
  query?: string;
  // Rows shown so far / whether more exist / total matches — drives Load more.
  limit: number;
  hasMore: boolean;
  total: number;
  tabs?: readonly Filter[];
  showTelescreenLink?: boolean;
  // Ban is a permanent, program-wide action — unlike Approve/Reject/Fraud,
  // reviewers never get this button, even though they share this component.
  isAdmin?: boolean;
  variant?: "admin" | "review";
}) {
  const [rejectDraft, setRejectDraft] = useState<Record<string, string>>({});
  const [approveMessageDraft, setApproveMessageDraft] = useState<Record<string, string>>({});
  const [hoursDraft, setHoursDraft] = useState<Record<string, string>>({});
  const [justificationDraft, setJustificationDraft] = useState<Record<string, string>>({});
  const [savedHoursOverride, setSavedHoursOverride] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const basePath = variant === "review" ? "/review" : "/admin";

  async function act(
    recordId: string,
    action: "approve" | "reject" | "fraud" | "hours" | "ban",
    extra?: Record<string, unknown>,
  ) {
    // In review mode, Approve/Reject are non-terminal precheck
    // recommendations — they hit the `precheck` action (justification +
    // deflated hours, no payout) instead of the terminal approve/reject
    // action an admin uses to finalize a submission.
    const isPrecheck = variant === "review" && (action === "approve" || action === "reject");
    const apiAction = isPrecheck ? "precheck" : action;

    const message = isPrecheck
      ? undefined
      : action === "reject"
        ? rejectDraft[recordId]?.trim()
        : action === "approve"
          ? approveMessageDraft[recordId]?.trim() || undefined
          : undefined;
    if (!isPrecheck && action === "reject" && !message) return;

    const payload: Record<string, unknown> = { recordId, action: apiAction, message, ...extra };
    if (isPrecheck) payload.verdict = action;

    setBusy(recordId);
    try {
      const res = await fetch("/api/admin/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        if (action === "hours") {
          // Hours doesn't change review status or move the row to another
          // tab — update it locally instead of reloading the whole queue,
          // which would wipe in-progress justification/message drafts on
          // every other row.
          const savedHours = Number(extra?.hours);
          if (Number.isFinite(savedHours)) {
            setSavedHoursOverride((s) => ({ ...s, [recordId]: savedHours }));
          }
          setHoursDraft((d) => {
            const next = { ...d };
            delete next[recordId];
            return next;
          });
        } else {
          window.location.reload();
        }
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={basePath} method="get" className="flex gap-2 items-center flex-wrap">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search all projects (name, URL, description, email, ID)..."
          className="input input-bordered input-sm flex-1 min-w-64"
        />
        <button type="submit" className="btn btn-sm">
          Search
        </button>
        {query && (
          <a href={basePath} className="btn btn-sm btn-ghost">
            Clear
          </a>
        )}
      </form>

      <div className="tabs tabs-boxed w-fit">
        {tabs.map((f) => (
          <a
            key={f}
            href={`${basePath}?status=${f}`}
            className={`tab ${!query && filter === f ? "tab-active" : ""}`}
          >
            {f}
          </a>
        ))}
      </div>

      {query && (
        <p className="text-sm opacity-70">
          {total} result{total === 1 ? "" : "s"} for “{query}” across all statuses
        </p>
      )}

      {rows.length === 0 && (
        <p className="opacity-60">{query ? "No submissions match your search." : "No submissions in this view."}</p>
      )}

      {rows.map((row) => {
        const storedHours = savedHoursOverride[row.id] ?? row.hours;
        const hoursValue = hoursDraft[row.id] ?? String(row.reviewerHours ?? storedHours);
        const parsedHours = Number(hoursValue);
        const hoursValid = Number.isFinite(parsedHours) && parsedHours >= 0;
        const hoursChanged =
          hoursValid && Math.round(parsedHours * 10) / 10 !== Math.round(storedHours * 10) / 10;
        const justificationValue = justificationDraft[row.id] ?? row.reviewerJustification ?? "";
        const precheckReady = hoursValid && justificationValue.trim().length > 0;

        return (
        <div key={row.id} id={row.id} className="card bg-base-200 p-4 gap-3">
          {row.isBanned && (
            <div className="alert alert-error py-2 text-sm">⛔ (banned user)</div>
          )}
          <UnifiedStatus recordId={row.id} />
          {row.duplicateRecordIds.length > 0 && (
            <div className="alert alert-warning py-2 text-sm">
              {row.duplicateHasApproved
                ? "⚠ Code URL already approved on another submission"
                : "⚠ Duplicate Code URL — shared with another submission"}
              {" "}({row.duplicateRecordIds.join(", ")})
            </div>
          )}
          {variant === "admin" && row.reviewerVerdict && (
            <div className="alert alert-info py-2 text-sm flex-col items-start gap-1">
              <span>
                Prereviewed by {row.reviewerReviewedBy ?? "a reviewer"}: <strong>{row.reviewerVerdict}</strong>
                {typeof row.reviewerHours === "number" &&
                  ` — suggested ${Math.round(row.reviewerHours * 10) / 10}h`}
              </span>
              {row.reviewerJustification && <span className="opacity-80">{row.reviewerJustification}</span>}
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
              {row.lapseLinks && (
                <p>
                  Lapse:{" "}
                  {row.lapseLinks
                    .split(",")
                    .map((link) => link.trim())
                    .filter(Boolean)
                    .map((link, i) => (
                      <a key={i} className="link mr-2" href={link} target="_blank" rel="noreferrer">
                        {link}
                      </a>
                    ))}
                </p>
              )}
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
              stored: {Math.round(storedHours * 10) / 10}h
            </span>
            {variant === "admin" && (
              <button
                className="btn btn-sm"
                disabled={busy === row.id || !hoursValid || !hoursChanged}
                onClick={() =>
                  act(row.id, "hours", { hours: parsedHours, justification: justificationValue.trim() || undefined })
                }
              >
                Save hours
              </button>
            )}
            <div className="flex flex-col gap-1 flex-1 min-w-48">
              <textarea
                className="textarea textarea-bordered textarea-sm"
                placeholder={
                  variant === "review" ? "Justification (required)..." : "Override justification (optional)..."
                }
                rows={2}
                value={justificationValue}
                onChange={(e) => setJustificationDraft((d) => ({ ...d, [row.id]: e.target.value }))}
              />
              {(row.hackatimeProjects || row.hackatimeId) && (
                <button
                  type="button"
                  className="btn btn-xs btn-outline self-start"
                  onClick={() =>
                    setJustificationDraft((d) => {
                      const current = d[row.id] ?? row.reviewerJustification ?? "";
                      const note = [
                        row.hackatimeProjects && `Hackatime: ${row.hackatimeProjects}`,
                        row.hackatimeId && `(ID ${row.hackatimeId})`,
                        row.telescreenLink,
                      ]
                        .filter(Boolean)
                        .join(" ");
                      return { ...d, [row.id]: current ? `${current}\n${note}` : note };
                    })
                  }
                >
                  + Insert Hackatime info
                </button>
              )}
            </div>
          </div>

          {variant === "review" ? (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 flex-wrap items-center">
                <button
                  className="btn btn-success btn-sm"
                  disabled={busy === row.id || !precheckReady}
                  onClick={() =>
                    act(row.id, "approve", { hours: parsedHours, justification: justificationValue.trim() })
                  }
                >
                  Recommend Approve
                </button>
                <button
                  className="btn btn-warning btn-sm"
                  disabled={busy === row.id || !precheckReady}
                  onClick={() =>
                    act(row.id, "reject", { hours: parsedHours, justification: justificationValue.trim() })
                  }
                >
                  Recommend Reject
                </button>
              </div>
              <p className="text-xs opacity-60">
                This records your verdict and suggested hours for an admin to finalize — it does not approve,
                reject, or pay out anything by itself.
              </p>
            </div>
          ) : (
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
            {isAdmin && !row.isBanned && (
              <button
                className="btn btn-error btn-outline btn-sm"
                disabled={busy === row.id}
                onClick={() => {
                  if (window.confirm("Ban this submitter from the program? This is permanent until an admin unbans them.")) {
                    act(row.id, "ban");
                  }
                }}
              >
                ⛔ Ban user
              </button>
            )}
          </div>
          )}

          <MessagesSection recordId={row.id} />
        </div>
        );
      })}

      {hasMore && (
        <a
          href={`${basePath}?${new URLSearchParams({
            ...(query ? { q: query } : { status: filter }),
            limit: String(limit + QUEUE_PAGE_SIZE),
          }).toString()}#${rows[rows.length - 1]?.id ?? ""}`}
          className="btn btn-outline self-center"
        >
          Load more ({rows.length} of {total})
        </a>
      )}
    </div>
  );
}

function UnifiedStatus({ recordId }: { recordId: string }) {
  const [info, setInfo] = useState<UnifiedInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/unified?id=${encodeURIComponent(recordId)}`)
      .then((res) => (res.ok ? res.json() : { status: "unavailable" }))
      .catch(() => ({ status: "unavailable" }))
      .then((data) => {
        if (!cancelled) setInfo(data as UnifiedInfo);
      });
    return () => {
      cancelled = true;
    };
  }, [recordId]);

  if (!info) return <p className="text-xs opacity-50">Checking Unified…</p>;
  if (info.status === "none") return <p className="text-xs opacity-60">Unified: not submitted</p>;
  if (info.status === "unavailable") return <p className="text-xs opacity-60">Unified: lookup unavailable</p>;
  return (
    <div className="alert alert-info py-2 text-sm flex-col items-start gap-1">
      <span>
        ✅ Submitted to Unified — {info.ships.length} ship{info.ships.length === 1 ? "" : "s"}, {info.totalHours}h total
        {info.searchUrl && (
          <>
            {" "}
            <a className="link" href={info.searchUrl} target="_blank" rel="noreferrer">
              view
            </a>
          </>
        )}
      </span>
      <ul className="opacity-80 list-disc pl-5">
        {info.ships.map((ship, i) => (
          <li key={i}>
            {ship.user} · {ship.program} · {ship.hours}h · {ship.approvedAt}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Fetched the first time the section is opened, not with the page.
function MessagesSection({ recordId }: { recordId: string }) {
  const [opened, setOpened] = useState(false);
  const [messages, setMessages] = useState<ThreadMessage[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!opened) return;
    let cancelled = false;
    fetch(`/api/admin/messages?id=${encodeURIComponent(recordId)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((data) => {
        if (!cancelled) setMessages(data.messages as ThreadMessage[]);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [opened, recordId]);

  return (
    <details onToggle={(e) => e.currentTarget.open && setOpened(true)}>
      <summary className="cursor-pointer text-sm opacity-70">Messages</summary>
      <div className="pt-2">
        {failed ? (
          <p className="text-sm opacity-60">Couldn’t load messages.</p>
        ) : messages ? (
          <MessageThread messages={messages} />
        ) : (
          <p className="text-sm opacity-60">Loading…</p>
        )}
      </div>
    </details>
  );
}
