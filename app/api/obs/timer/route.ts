import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "../../../../src/lib/rateLimit";
import { getTimerState, StreamNotConfiguredError, type TimerState } from "../../../../src/lib/timer";

// Unauthenticated on purpose — OBS Browser Sources can't complete an OAuth
// redirect or hold a login session (see design.md Decision 2).
export const dynamic = "force-dynamic";

const CACHE_MS = 5000;
let cache: { at: number; state: TimerState } | null = null;

async function cachedTimerState(): Promise<TimerState> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return cache.state;
  const state = await getTimerState();
  cache = { at: now, state };
  return state;
}

export async function GET(request: Request) {
  if (!rateLimit(`obs-timer:${clientIp(request)}`, 120, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let state;
  try {
    state = await cachedTimerState();
  } catch (err) {
    if (err instanceof StreamNotConfiguredError) {
      return NextResponse.json({ error: "stream_not_configured" }, { status: 503 });
    }
    throw err;
  }

  // Manual operator toggle (see add-prelaunch-homepage-mode/design.md Decision 1-2).
  // Strict "true" match so PRELAUNCH_MODE=false / 0 / unset all mean live mode.
  const prelaunch = String(process.env.PRELAUNCH_MODE ?? "").toLowerCase() === "true";

  // Same terms as the deadline formula, minus STREAM_START_AT — i.e. how long the
  // stream will run once it starts. Display-only figure for the prelaunch hero.
  const bankedMinutes =
    state.initialMinutes +
    state.approvedHours * state.minutesPerHour +
    state.adjustmentMinutes;

  return NextResponse.json(
    {
      deadline: state.deadline,
      approvedHours: state.approvedHours,
      adjustmentMinutes: state.adjustmentMinutes,
      prelaunch,
      streamStartAt: state.streamStartAt,
      bankedMinutes,
    },
    { headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=25" } },
  );
}
