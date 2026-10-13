"use client";

import { Fragment, useState } from "react";
import type { ItemLine, SpendStatus, UserView } from "../../../../src/lib/fulfillment";
import { displayName, hrs, projectLabel, usd, userAnchor } from "./format";
import SnapshotPanel, { ProjectLinks, UnifiedBadge } from "./SnapshotPanel";

const STATUS_BADGE: Record<SpendStatus, string> = {
  EXPLOIT: "badge-error",
  OVERAGE: "badge-warning",
  OK: "badge-success",
  UNKNOWN: "badge-ghost",
};

export type LineActions = {
  pending: string | null; // `${email}|${line.key}` of the line with a request in flight
  errors: Record<string, string>;
  onFulfill: (line: ItemLine, fulfilled: boolean) => void;
  onRefund: (line: ItemLine) => void;
};

function LineRow({ view, line, isSelf, actions }: { view: UserView; line: ItemLine; isSelf: boolean; actions: LineActions }) {
  const [showSnapshot, setShowSnapshot] = useState(false);
  const id = `${view.email}|${line.key}`;
  const busy = actions.pending === id;
  return (
    <Fragment>
      <tr>
        <td>
          {line.itemName}
          {line.count > 1 && <span className="opacity-60"> ×{line.count}</span>}
        </td>
        <td className="font-mono">{hrs(line.hours)}</td>
        <td className="font-mono">{usd(line.usd)}</td>
        <td>
          <div className="flex flex-wrap gap-2 items-center justify-end">
            {line.referralId && (
              <a href={`/admin/referrals#${line.referralId}`} className="link text-xs opacity-70">
                referral →
              </a>
            )}
            <button className="btn btn-xs" onClick={() => setShowSnapshot((s) => !s)}>
              {showSnapshot ? "hide" : "snapshot"}
            </button>
            {!isSelf && line.refundable && !line.fulfilled && (
              <button className="btn btn-xs btn-error btn-outline" disabled={busy} onClick={() => actions.onRefund(line)}>
                refund{line.count > 1 ? " 1" : ""}
              </button>
            )}
            {!isSelf &&
              (line.fulfilled ? (
                <button className="btn btn-xs" disabled={busy} onClick={() => actions.onFulfill(line, false)}>
                  {busy ? "saving…" : "unfulfill"}
                </button>
              ) : (
                <button className="btn btn-xs btn-success" disabled={busy} onClick={() => actions.onFulfill(line, true)}>
                  {busy ? "saving…" : "fulfill"}
                </button>
              ))}
          </div>
          {actions.errors[id] && <p className="text-xs text-error text-right">{actions.errors[id]}</p>}
        </td>
      </tr>
      {showSnapshot && (
        <tr>
          <td colSpan={4} className="bg-base-200">
            <SnapshotPanel redemptionId={line.recordIds[0]} />
          </td>
        </tr>
      )}
    </Fragment>
  );
}

function LineTable({ view, lines, isSelf, actions }: { view: UserView; lines: ItemLine[]; isSelf: boolean; actions: LineActions }) {
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <tbody>
          {lines.map((line) => (
            <LineRow key={line.key} view={view} line={line} isSelf={isSelf} actions={actions} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function UserCard({
  view,
  open,
  onToggle,
  isSelf,
  actions,
}: {
  view: UserView;
  open: boolean;
  onToggle: () => void;
  isSelf: boolean;
  actions: LineActions;
}) {
  const [showFulfilled, setShowFulfilled] = useState(false);
  return (
    <div id={userAnchor(view.email)} className="border border-base-300 rounded-box scroll-mt-4">
      <button className="w-full p-4 flex flex-wrap gap-x-4 gap-y-1 items-center text-left" onClick={onToggle}>
        <span className="opacity-60">{open ? "▾" : "▸"}</span>
        <span className="font-bold">{displayName(view)}</span>
        <span className={`badge ${STATUS_BADGE[view.status]}`}>{view.status}</span>
        <span className="text-sm opacity-70 font-mono">
          spent {hrs(view.spent)} · unified {view.unifiedHours === null ? "?" : hrs(view.unifiedHours)} · local{" "}
          {hrs(view.localHours)}
        </span>
        {view.unfulfilledHours > 0 && (
          <span className="text-sm ml-auto">{hrs(view.unfulfilledHours)} unfulfilled</span>
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          <p className="text-xs opacity-60">
            {view.email}
            {isSelf && " · your own purchases — another admin has to fulfill these"}
          </p>
          <div>
            <p className="text-sm font-bold mb-1">unfulfilled</p>
            {view.unfulfilled.length === 0 ? (
              <p className="text-sm opacity-60">Nothing left to fulfill.</p>
            ) : (
              <LineTable view={view} lines={view.unfulfilled} isSelf={isSelf} actions={actions} />
            )}
          </div>
          {view.fulfilled.length > 0 && (
            <div>
              <button className="text-sm font-bold" onClick={() => setShowFulfilled((s) => !s)}>
                {showFulfilled ? "▾" : "▸"} fulfilled ({view.fulfilled.reduce((n, l) => n + l.count, 0)})
              </button>
              {showFulfilled && <LineTable view={view} lines={view.fulfilled} isSelf={isSelf} actions={actions} />}
            </div>
          )}
          <div>
            <p className="text-sm font-bold mb-1">projects</p>
            {view.projects.length === 0 ? (
              <p className="text-sm opacity-60">No approved projects.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {view.projects.map((p) => (
                  <li key={p.id} className="flex flex-wrap justify-between gap-2 items-center">
                    <span className="flex flex-wrap gap-2 items-center min-w-0">
                      <span className="truncate font-mono">{projectLabel(p)}</span>
                      <UnifiedBadge inUnified={p.inUnified} />
                      <ProjectLinks project={p} />
                    </span>
                    <span className="font-mono">{hrs(p.hours)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
