"use client";

import { useEffect, useState } from "react";

const RESYNC_MS = 5000;

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export default function ObsTimerPage() {
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      try {
        const res = await fetch("/api/obs/timer");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setDeadline(new Date(data.deadline).getTime());
      } catch {
        // Transient network hiccup — the next poll will retry.
      }
    }

    sync();
    const resyncInterval = setInterval(sync, RESYNC_MS);
    const tickInterval = setInterval(() => setNow(Date.now()), 1000);

    return () => {
      cancelled = true;
      clearInterval(resyncInterval);
      clearInterval(tickInterval);
    };
  }, []);

  const remaining = deadline !== null ? deadline - now : null;
  const expired = remaining !== null && remaining <= 0;

  return (

    <div className="w-screen h-screen">
      <p className="font-2 text-6xl">
        {remaining === null ? "--:--:--" : expired ? "00:00:00" : formatRemaining(remaining)}
      </p>
    </div>
    // <main
    //   style={{
    //     background: "transparent",
    //     width: "100vw",
    //     height: "100vh",
    //     display: "flex",
    //     alignItems: "center",
    //     justifyContent: "center",
    //   }}
    // >
    //   <span
    //     className="font-mono font-bold"
    //     style={{
    //       fontSize: "12vw",
    //       lineHeight: 1,
    //       color: expired ? "#ff4d4f" : "#ffffff",
    //       textShadow: "0 0 12px rgba(0,0,0,0.85)",
    //     }}
    //   >
    //     {remaining === null ? "--:--:--" : expired ? "00:00:00" : formatRemaining(remaining)}
    //   </span>
    // </main>
  );
}
