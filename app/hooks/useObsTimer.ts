"use client";

import { useEffect, useState } from "react";

const RESYNC_MS = 5000;

type TimerSnapshot = {
  deadline?: string;
  prelaunch?: boolean;
  streamStartAt?: string | null;
  bankedMinutes?: number;
};

export function useObsTimer() {
  const [deadline, setDeadline] = useState<number | null>(null);
  const [prelaunch, setPrelaunch] = useState(false);
  const [streamStartAt, setStreamStartAt] = useState<number | null>(null);
  const [bankedMinutes, setBankedMinutes] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      try {
        const response = await fetch("/api/obs/timer", { cache: "no-store" });
        if (!response.ok) {
          if (!cancelled) {
            setDeadline(null);
            setStreamStartAt(null);
            setBankedMinutes(null);
          }
          return;
        }

        const data = (await response.json()) as TimerSnapshot;
        if (cancelled) return;

        setDeadline(data.deadline ? new Date(data.deadline).getTime() : null);
        setPrelaunch(Boolean(data.prelaunch));
        setStreamStartAt(data.streamStartAt ? new Date(data.streamStartAt).getTime() : null);
        setBankedMinutes(typeof data.bankedMinutes === "number" ? data.bankedMinutes : null);
      } catch {
        // A later poll retries transient network failures.
      }
    }

    void sync();
    const resyncInterval = window.setInterval(sync, RESYNC_MS);
    const tickInterval = window.setInterval(() => setNow(Date.now()), 1000);

    return () => {
      cancelled = true;
      window.clearInterval(resyncInterval);
      window.clearInterval(tickInterval);
    };
  }, []);

  return { deadline, prelaunch, streamStartAt, bankedMinutes, now };
}
