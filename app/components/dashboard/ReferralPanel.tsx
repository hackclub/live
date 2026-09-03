"use client";

import { useEffect, useState } from "react";
import ReferralCodeForm from "./ReferralCodeForm";

type Props = {
  handle: string;
  referrerHandle: string | null;
  hasSubmissions: boolean;
  referredCount: number;
};

export default function ReferralPanel({
  handle,
  referrerHandle,
  hasSubmissions,
  referredCount,
}: Props) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Browser-only value, read once on mount so SSR and first render agree on "".
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
  }, []);

  const link = handle ? `${origin || ""}/?ref=${handle}` : "";

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the input is selectable as a fallback */
    }
  }

  return (
    <div className="pt-6 border-t-2 mt-4 flex flex-col gap-3">
      <p className="font-2 text-lg">Refer a friend</p>

      {handle ? (
        <>
          <p className="text-sm font-2 opacity-80">
            when someone you refer ships a project, a water balloon gets thrown at me for you.
          </p>
          <div className="flex flex-row gap-2 items-center">
            <input
              readOnly
              value={link || `…/?ref=${handle}`}
              onFocus={(e) => e.currentTarget.select()}
              className="input input-bordered input-sm font-2 flex-1"
            />
            <button onClick={copy} className="btn btn-secondary btn-sm font-2" type="button">
              {copied ? "copied!" : "copy"}
            </button>
          </div>
          <p className="text-xs font-2 opacity-60">
            your code is <span className="text-primary">{handle}</span>
          </p>
          <p className="font-2 text-sm">
            referred <span className="text-primary font-bold">{referredCount}</span>{" "}
            {referredCount === 1 ? "person" : "people"} who shipped ·{" "}
            <span className="text-primary font-bold">{referredCount}</span>{" "}
            {referredCount === 1 ? "balloon" : "balloons"} earned
          </p>
        </>
      ) : (
        <p className="text-sm font-2 opacity-60">
          log in with a GitHub-linked Hackatime account to get a referral link.
        </p>
      )}

      {referrerHandle ? (
        <p className="font-2 text-sm">
          Referred by <span className="text-primary">@{referrerHandle}</span>
        </p>
      ) : (
        !hasSubmissions && <ReferralCodeForm />
      )}
    </div>
  );
}
