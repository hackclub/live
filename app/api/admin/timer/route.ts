import { NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../src/lib/auth";
import { isAdminEmail } from "../../../../src/lib/admin";
import { getIdentity } from "../../../../src/lib/hackclub";
import {
  getTimerAdjustmentMinutes,
  setTimerAdjustmentMinutes,
} from "../../../../src/lib/airtable";
import { withLock } from "../../../../src/lib/lock";
import { getTimerState, StreamNotConfiguredError } from "../../../../src/lib/timer";

export const dynamic = "force-dynamic";

type Gate = { ok: true; email: string } | { ok: false; response: NextResponse };

// Same identity check as app/api/admin/review/route.ts.
async function requireAdmin(request: Request): Promise<Gate> {
  const session = await getSessionFromRequest(request);
  if (!session?.access_token) {
    return { ok: false, response: NextResponse.json({ error: "not_authenticated" }, { status: 401 }) };
  }
  const identity = await getIdentity(session.access_token);
  if (!identity?.primary_email || !isAdminEmail(identity.primary_email)) {
    return { ok: false, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { ok: true, email: identity.primary_email };
}

async function stateResponse() {
  try {
    return NextResponse.json(await getTimerState());
  } catch (err) {
    if (err instanceof StreamNotConfiguredError) {
      return NextResponse.json({ error: "stream_not_configured" }, { status: 503 });
    }
    throw err;
  }
}

export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  return stateResponse();
}

export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const payload = (body ?? {}) as { deltaMinutes?: unknown; reset?: unknown };

  let delta = 0;
  if (payload.reset === true) {
    delta = 0;
  } else if (typeof payload.deltaMinutes === "number" && Number.isInteger(payload.deltaMinutes)) {
    delta = payload.deltaMinutes;
  } else {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    await withLock("timer-adjustment", async () => {
      const value =
        payload.reset === true ? 0 : (await getTimerAdjustmentMinutes()) + delta;
      await setTimerAdjustmentMinutes(value);
    });
  } catch (err) {
    console.error("[admin-timer] updating adjustment failed", err);
    return NextResponse.json({ error: "timer_adjustment_unavailable" }, { status: 503 });
  }

  return stateResponse();
}
