"use client";

import { useState } from "react";

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
            <label className="label">Lapse Link</label>
            <input
              name="lapseLinks"
              className="input input-bordered w-full"
              defaultValue={defaults?.lapseLinks}
              placeholder="Required for hardware submissions"
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

      {/* Address + birthday are pulled from your Hack Club identity — shown
          here read-only, not editable, and not sent from this form. */}
      <p className="text-sm opacity-70">
        Shipping address and birthday come from your verified Hack Club identity.
      </p>

      <div>
        <label className="label">Address (Line 1)</label>
        <input className="input input-bordered w-full" value={defaults?.addressLine1 ?? ""} disabled />
      </div>

      <div>
        <label className="label">Address (Line 2)</label>
        <input className="input input-bordered w-full" value={defaults?.addressLine2 ?? ""} disabled />
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="label">City</label>
          <input className="input input-bordered w-full" value={defaults?.city ?? ""} disabled />
        </div>
        <div className="flex-1">
          <label className="label">State / Province</label>
          <input className="input input-bordered w-full" value={defaults?.state ?? ""} disabled />
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="label">Country</label>
          <input className="input input-bordered w-full" value={defaults?.country ?? ""} disabled />
        </div>
        <div className="flex-1">
          <label className="label">ZIP / Postal Code</label>
          <input className="input input-bordered w-full" value={defaults?.zip ?? ""} disabled />
        </div>
      </div>

      <div>
        <label className="label">Birthday</label>
        <input type="date" className="input input-bordered w-full" value={defaults?.birthday ?? ""} disabled />
      </div>

      {genericError && <p className="text-error">{genericError}</p>}
      {success && <p className="text-success">Saved! Refresh to see the updated status.</p>}

      <button type="submit" className="btn btn-primary" disabled={submitting}>
        {submitting ? "Submitting..." : recordId ? "Save & resubmit" : "Submit project"}
      </button>
    </form>
  );
}
