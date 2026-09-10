"use client";

import { useState } from "react";

export type BannedUserRow = {
  id: string;
  email: string;
  bannedAt: string;
  bannedBy: string;
  reason: string;
};

export default function BannedUsersTable({ rows: initialRows }: { rows: BannedUserRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [unbanning, setUnbanning] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);

  const [banEmail, setBanEmail] = useState("");
  const [banReason, setBanReason] = useState("");
  const [banning, setBanning] = useState(false);
  const [banError, setBanError] = useState<string | null>(null);

  async function handleBan(e: React.FormEvent) {
    e.preventDefault();
    const email = banEmail.trim();
    if (!email) return;
    if (!confirm(`Ban ${email} from the program? This is permanent until an admin unbans them.`)) return;

    setBanError(null);
    setBanning(true);
    try {
      const res = await fetch("/api/admin/ban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, reason: banReason.trim() || undefined }),
      });
      if (!res.ok) {
        setBanError("Ban failed.");
        return;
      }
      window.location.reload();
    } catch {
      setBanError("Network error.");
    } finally {
      setBanning(false);
    }
  }

  async function handleUnban(row: BannedUserRow) {
    if (!confirm(`Unban ${row.email}? They'll regain access immediately.`)) return;
    setError(null);
    setUnbanning(row.id);
    try {
      const res = await fetch("/api/admin/ban", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: row.email }),
      });
      if (!res.ok) {
        setError({ id: row.id, message: "Unban failed." });
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch {
      setError({ id: row.id, message: "Network error." });
    } finally {
      setUnbanning(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleBan} className="flex gap-2 flex-wrap items-center">
        <input
          type="email"
          required
          placeholder="email to ban…"
          className="input input-bordered input-sm min-w-64"
          value={banEmail}
          onChange={(e) => setBanEmail(e.target.value)}
        />
        <input
          placeholder="reason (optional)"
          className="input input-bordered input-sm flex-1 min-w-48"
          value={banReason}
          onChange={(e) => setBanReason(e.target.value)}
        />
        <button type="submit" className="btn btn-error btn-sm" disabled={banning || !banEmail.trim()}>
          ⛔ Ban by email
        </button>
        {banError && <p className="text-xs text-error">{banError}</p>}
      </form>

      {rows.length === 0 ? (
        <p className="opacity-60 text-sm">No banned users.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Banned At</th>
                <th>Banned By</th>
                <th>Reason</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} id={row.id}>
                  <td>{row.email}</td>
                  <td>{row.bannedAt ? new Date(row.bannedAt).toLocaleString() : "—"}</td>
                  <td>{row.bannedBy}</td>
                  <td>{row.reason || "—"}</td>
                  <td className="text-right">
                    <button
                      className="btn btn-xs"
                      disabled={unbanning === row.id}
                      onClick={() => handleUnban(row)}
                    >
                      {unbanning === row.id ? "unbanning…" : "unban"}
                    </button>
                    {error?.id === row.id && <p className="text-xs text-error">{error.message}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
