"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ERROR_COPY: Record<string, string> = {
  self_referral: "you can't refer yourself :)",
  already_bound: "you've already got a referrer set.",
  already_submitted: "referral codes have to be entered before you submit a project.",
  unknown_code: "that referral code doesn't match anyone.",
  not_authenticated: "log in first.",
  identity_unavailable: "couldn't read your account — try again.",
};

export default function ReferralCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/referral/bind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        router.refresh();
        return;
      }
      setError(ERROR_COPY[data.error] ?? "couldn't apply that code.");
    } catch {
      setError("network error — try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label className="text-sm font-2 opacity-80" htmlFor="referral-code">
        got a referral code?
      </label>
      <div className="flex flex-row gap-2">
        <input
          id="referral-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="their github username"
          className="input input-bordered input-sm font-2 flex-1"
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={pending || !code.trim()}
          className="btn btn-secondary btn-sm font-2"
        >
          {pending ? "…" : "apply"}
        </button>
      </div>
      {error && <p className="text-error text-sm font-2">{error}</p>}
    </form>
  );
}
