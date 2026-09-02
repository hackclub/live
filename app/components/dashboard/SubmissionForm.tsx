"use client";

import { useState } from "react";
import {
  getWorkLogCopy,
  WORK_LOG_TYPES,
  type WorkLogType,
} from "../../../src/lib/submission";

type HackatimeProjectOption = { name: string; hours: number };
type Track = "software" | "hardware";

export default function SubmissionForm({
  githubUsername,
  hackatimeProjects,
  recordId,
  defaults,
  onSaved,
}: {
  githubUsername: string;
  hackatimeProjects: HackatimeProjectOption[];
  recordId?: string;
  defaults?: {
    track?: Track;
    workLogType?: WorkLogType;
    codeUrl?: string;
    playableUrl?: string;
    description?: string;
    lapseLinks?: string;
    hardwareHours?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    country?: string;
    zip?: string;
    birthday?: string;
  };
  onSaved?: () => void;
}) {
  const [track, setTrack] = useState<Track>(defaults?.track ?? "software");
  const [workLogType, setWorkLogType] = useState<WorkLogType>(
    defaults?.workLogType ?? WORK_LOG_TYPES.lapse,
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [genericError, setGenericError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setGenericError(null);
    setFieldErrors({});
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    formData.set("track", track);
    formData.set("workLogType", workLogType);
    if (recordId) formData.set("recordId", recordId);

    try {
      const res = await fetch("/api/submit", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        if (data.fieldErrors) setFieldErrors(data.fieldErrors);
        else setGenericError("Something went wrong submitting your project. Try again.");
        return;
      }
      setSuccess(true);
      onSaved?.();
    } catch {
      setGenericError("Something went wrong submitting your project. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const workLogCopy = getWorkLogCopy(workLogType);

  return (
    <form onSubmit={onSubmit} className="flex font-2 flex-col gap-4 max-w-xl">
      <div>
        <label className="label">GitHub Username</label>
        <input className="input input-primary input-bordered w-full" value={githubUsername} disabled />
      </div>

      <div className="join">
        <button
          type="button"
          className={`join-item btn ${track === "software" ? "btn-primary" : ""}`}
          onClick={() => setTrack("software")}
        >
          Software
        </button>
        <button
          type="button"
          className={`join-item btn ${track === "hardware" ? "btn-primary" : ""}`}
          onClick={() => setTrack("hardware")}
        >
          Hardware
        </button>
      </div>

      {track === "software" ? (
        <div>
          <label className="label">Hackatime Project</label>
          <select name="hackatimeProject" className="select select-bordered w-full" defaultValue="" required>
            <option value="" disabled>
              Select the project this submission tracks hours under
            </option>
            {hackatimeProjects.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name} — {p.hours.toFixed(1)}h tracked
              </option>
            ))}
          </select>
          {fieldErrors.hackatimeProject && <p className="text-error text-sm">{fieldErrors.hackatimeProject}</p>}
        </div>
      ) : (
        <>
          <div>
            <div className="join" aria-label="Work log type">
              <button
                type="button"
                className={`join-item btn ${workLogType === WORK_LOG_TYPES.lapse ? "btn-primary" : ""}`}
                aria-pressed={workLogType === WORK_LOG_TYPES.lapse}
                onClick={() => setWorkLogType(WORK_LOG_TYPES.lapse)}
              >
                Lapse
              </button>
              <button
                type="button"
                className={`join-item btn ${workLogType === WORK_LOG_TYPES.gitJournal ? "btn-primary" : ""}`}
                aria-pressed={workLogType === WORK_LOG_TYPES.gitJournal}
                onClick={() => setWorkLogType(WORK_LOG_TYPES.gitJournal)}
              >
                Git Journal
              </button>
            </div>
            {fieldErrors.workLogType && <p className="text-error text-sm">{fieldErrors.workLogType}</p>}
          </div>
          <div>
            <label className="label">{workLogCopy.label}</label>
            <input
              name="lapseLinks"
              className="input input-bordered w-full"
              defaultValue={defaults?.lapseLinks}
              placeholder={workLogCopy.placeholder}
              required
            />
            {fieldErrors.lapseLinks && <p className="text-error text-sm">{fieldErrors.lapseLinks}</p>}
          </div>
          <div>
            <label className="label">Hours Spent</label>
            <input
              name="hardwareHours"
              type="number"
              step="0.1"
              min="0"
              className="input input-bordered w-full"
              defaultValue={defaults?.hardwareHours}
              required
            />
            {fieldErrors.hardwareHours && <p className="text-error text-sm">{fieldErrors.hardwareHours}</p>}
          </div>
        </>
      )}

      <div>
        <label className="label">Code URL</label>
        <input name="codeUrl" className="input input-bordered w-full" defaultValue={defaults?.codeUrl} required />
        {fieldErrors.codeUrl && <p className="text-error text-sm">{fieldErrors.codeUrl}</p>}
      </div>

      <div>
        <label className="label">Playable URL</label>
        <input name="playableUrl" className="input input-bordered w-full" defaultValue={defaults?.playableUrl} required />
        {fieldErrors.playableUrl && <p className="text-error text-sm">{fieldErrors.playableUrl}</p>}
      </div>

      {track === "software" && (
        <div>
          <label className="label">Lapse Link(s) (comma-separated)</label>
          <input name="lapseLinks" className="input input-bordered w-full" defaultValue={defaults?.lapseLinks} />
        </div>
      )}

      <div>
        <label className="label">Description</label>
        <textarea name="description" className="textarea textarea-bordered w-full" defaultValue={defaults?.description} required />
        {fieldErrors.description && <p className="text-error text-sm">{fieldErrors.description}</p>}
      </div>

      {recordId && (
        <div>
          <label className="label text-error">What changed since last time?</label>
          <textarea
            name="updateNote"
            className="textarea textarea-bordered border-error w-full"
            placeholder="Describe what you fixed or changed for this resubmission"
          />
        </div>
      )}

      <div>
        <label className="label">Screenshot{recordId ? " (leave blank to keep the current one)" : ""}</label>
        <input
          name="screenshot"
          type="file"
          accept="image/*"
          className="file-input file-input-bordered w-full"
          required={!recordId}
        />
        {fieldErrors.screenshot && <p className="text-error text-sm">{fieldErrors.screenshot}</p>}
      </div>

      <div>
        <label className="label">Address (Line 1)</label>
        <input name="addressLine1" className="input input-bordered w-full" defaultValue={defaults?.addressLine1} required />
        {fieldErrors.addressLine1 && <p className="text-error text-sm">{fieldErrors.addressLine1}</p>}
      </div>

      <div>
        <label className="label">Address (Line 2)</label>
        <input name="addressLine2" className="input input-bordered w-full" defaultValue={defaults?.addressLine2} />
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="label">City</label>
          <input name="city" className="input input-bordered w-full" defaultValue={defaults?.city} required />
          {fieldErrors.city && <p className="text-error text-sm">{fieldErrors.city}</p>}
        </div>
        <div className="flex-1">
          <label className="label">State / Province</label>
          <input name="state" className="input input-bordered w-full" defaultValue={defaults?.state} required />
          {fieldErrors.state && <p className="text-error text-sm">{fieldErrors.state}</p>}
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="label">Country</label>
          <input name="country" className="input input-bordered w-full" defaultValue={defaults?.country} required />
          {fieldErrors.country && <p className="text-error text-sm">{fieldErrors.country}</p>}
        </div>
        <div className="flex-1">
          <label className="label">ZIP / Postal Code</label>
          <input name="zip" className="input input-bordered w-full" defaultValue={defaults?.zip} required />
          {fieldErrors.zip && <p className="text-error text-sm">{fieldErrors.zip}</p>}
        </div>
      </div>

      <div>
        <label className="label">Birthday</label>
        <input name="birthday" type="date" className="input input-bordered w-full" defaultValue={defaults?.birthday} required />
        {fieldErrors.birthday && <p className="text-error text-sm">{fieldErrors.birthday}</p>}
      </div>

      {genericError && <p className="text-error">{genericError}</p>}
      {success && <p className="text-success">Saved! Refresh to see the updated status.</p>}

      <button type="submit" className="btn btn-primary" disabled={submitting}>
        {submitting ? "Submitting..." : recordId ? "Save & resubmit" : "Submit project"}
      </button>
    </form>
  );
}
