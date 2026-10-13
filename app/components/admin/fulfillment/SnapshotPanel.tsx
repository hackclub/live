"use client";

import { useEffect, useState } from "react";
import type { ProjectView } from "../../../../src/lib/fulfillment";
import { hrs, projectLabel } from "./format";

type Snapshot = { submissions: ProjectView[]; totalHours: number; unifiedAvailable: boolean };

export function ProjectLinks({ project }: { project: ProjectView }) {
  return (
    <span className="flex gap-2 text-xs">
      {project.unifiedUrl && (
        <a href={project.unifiedUrl} target="_blank" rel="noreferrer" className="link">
          unified ↗
        </a>
      )}
      {project.codeUrl && (
        <a href={project.codeUrl} target="_blank" rel="noreferrer" className="link">
          code ↗
        </a>
      )}
      {project.playableUrl && (
        <a href={project.playableUrl} target="_blank" rel="noreferrer" className="link">
          playable ↗
        </a>
      )}
    </span>
  );
}

export function UnifiedBadge({ inUnified }: { inUnified: boolean }) {
  return inUnified ? (
    <span className="badge badge-sm badge-success">in Unified</span>
  ) : (
    <span className="badge badge-sm badge-ghost">local only</span>
  );
}

export default function SnapshotPanel({ redemptionId }: { redemptionId: string }) {
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
        Approved submissions as of this purchase (approximate — not a precise historical balance)
        {snapshot.unifiedAvailable ? "" : " · Unified unavailable, matches unknown"}:
      </p>
      <ul className="flex flex-col gap-1">
        {snapshot.submissions.map((s) => (
          <li key={s.id} className="flex flex-wrap justify-between gap-2 items-center">
            <span className="flex gap-2 items-center min-w-0">
              <span className="truncate font-mono">{projectLabel(s)}</span>
              <UnifiedBadge inUnified={s.inUnified} />
              <ProjectLinks project={s} />
            </span>
            <span className="font-mono">{hrs(s.hours)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 font-bold">Total: {hrs(snapshot.totalHours)}</p>
    </div>
  );
}
