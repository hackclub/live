import { redirect } from "next/navigation";
import { getSession } from "../../../src/lib/auth";
import { isAdminEmail } from "../../../src/lib/admin";
import { getIdentity } from "../../../src/lib/hackclub";
import { getTimerState, StreamNotConfiguredError, type TimerState } from "../../../src/lib/timer";
import TimerControls from "../../components/admin/TimerControls";

export default async function AdminTimerPage() {
  const session = await getSession();
  if (!session?.access_token) redirect("/api/auth/login");

  const identity = await getIdentity(session.access_token);
  if (!identity?.primary_email || !isAdminEmail(identity.primary_email)) {
    redirect("/");
  }

  let initialState: TimerState | null = null;
  try {
    initialState = await getTimerState();
  } catch (err) {
    if (!(err instanceof StreamNotConfiguredError)) throw err;
  }

  return (
    <section className="w-4/6 mx-auto min-h-screen py-10 flex flex-col gap-6">
      <div className="flex items-baseline gap-4">
        <p className="text-4xl">timer control.</p>
        <a href="/admin" className="link opacity-70">
          ← review queue
        </a>
      </div>

      {initialState ? (
        <TimerControls initialState={initialState} />
      ) : (
        <p className="opacity-70">
          Stream is not configured — <code>STREAM_START_AT</code> is unset or invalid. Set it
          before adjusting the timer.
        </p>
      )}
    </section>
  );
}
