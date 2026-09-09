"use client";

import { useState, useEffect } from "react";
import { FaTwitch } from "react-icons/fa";
import Link from "next/link";
import Footer from "./components/Footer";
const TWITCH_CHANNEL = "plastuchino";

// Banked stream time (initial + approved-hours + admin adjustment) rendered as
// "Xh Ym". Display-only — the prelaunch hero shows it, it never counts down.
function formatMinutes(mins: number): string {
    const total = Math.max(0, Math.floor(mins));
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${h}h ${m}m`;
}

// Shared days/hours/min/sec grid. `targetMs` null (API unavailable) → "--"
// placeholders instead of a fabricated countdown. Points at the stream-end
// `deadline` in live mode, or `streamStartAt` in prelaunch mode.
function CountdownGrid({ targetMs, now }: { targetMs: number | null; now: number }) {
    const hasTarget = targetMs !== null;
    const remaining = hasTarget ? Math.max(0, targetMs - now) : 0;
    const totalSeconds = Math.floor(remaining / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return (
        <div className="grid grid-flow-col gap-5 font-2 text-center auto-cols-max">
            {([
                { label: "days", value: days },
                { label: "hours", value: hours },
                { label: "min", value: minutes },
                { label: "sec", value: seconds },
            ] as const).map(({ label, value }) => (
                <div key={label} className="flex flex-col items-center">
                    {hasTarget ? (
                        <span className="countdown font-mono text-5xl">
                            <span
                                style={{ "--value": value } as React.CSSProperties}
                                aria-live="polite"
                                aria-label={`${value}`}
                            >
                                {value}
                            </span>
                        </span>
                    ) : (
                        <span className="font-mono text-5xl opacity-40" aria-label="unavailable">
                            --
                        </span>
                    )}
                    {label}
                </div>
            ))}
        </div>
    );
}

export default function Home() {


    // Synced to the real timer: same deadline the /obs-timer overlay counts to
    // (STREAM_START_AT + initial + approved-hours + the admin manual adjustment).
    const [deadline, setDeadline] = useState<number | null>(null);
    // Prelaunch mode (PRELAUNCH_MODE env, surfaced by /api/obs/timer): hide the
    // Twitch player, count down to the stream start instead of the stream end.
    const [prelaunch, setPrelaunch] = useState(false);
    const [streamStartAt, setStreamStartAt] = useState<number | null>(null);
    const [bankedMinutes, setBankedMinutes] = useState<number | null>(null);
    const [now, setNow] = useState(() => Date.now());
    const [hostname, setHostname] = useState("");


    useEffect(() => {

        setHostname(window.location.hostname);

        let cancelled = false;

        async function sync() {
            try {
                const res = await fetch("/api/obs/timer", { cache: "no-store" });
                if (!res.ok) {
                    // 503 stream_not_configured (or transient) — show a placeholder
                    // rather than a fabricated countdown. Keep the last known
                    // prelaunch flag so the layout doesn't flicker on a blip.
                    if (!cancelled) {
                        setDeadline(null);
                        setStreamStartAt(null);
                        setBankedMinutes(null);
                    }
                    return;
                }
                const data = await res.json();
                if (!cancelled) {
                    setDeadline(new Date(data.deadline).getTime());
                    setPrelaunch(Boolean(data.prelaunch));
                    setStreamStartAt(
                        data.streamStartAt ? new Date(data.streamStartAt).getTime() : null,
                    );
                    setBankedMinutes(
                        typeof data.bankedMinutes === "number" ? data.bankedMinutes : null,
                    );
                }
            } catch {
                // Network hiccup — the next poll retries.
            }
        }

        sync();
        const resync = setInterval(sync, 5000);
        const tick = setInterval(() => setNow(Date.now()), 1000);

        return () => {
            cancelled = true;
            clearInterval(resync);
            clearInterval(tick);
        };

    }, [])




    return (

        <>

        <section>

              <div className="flex flex-col items-center justify-center min-h-screen w-screen bg-base-300">

            {prelaunch ? (

            <div className="flex flex-col items-center gap-10 w-5/6 mx-auto text-center py-20">

                <p className="font-1 text-lg"><u>every</u> hour <b className="font-extrabold">building</b> increases the stream by <u className="px-3 py-1 bg-primary text-primary-content font-bold text-xl">5 minutes</u></p>

                <h1 className="font-2 text-7xl">the stream hasn&apos;t started <u>yet</u></h1>

                <div className="p-4 font-2 flex flex-col gap-4 w-fit mx-auto text-4xl">
                     <p>stream starts in</p>
                     <CountdownGrid targetMs={streamStartAt} now={now} />
                </div>

                <div className="font-2 flex flex-col gap-2 max-w-2xl">
                    <p className="text-3xl">stream length so far — <b>{bankedMinutes !== null ? formatMinutes(bankedMinutes) : "--"}</b></p>
                    <p className="text-lg opacity-80">every approved hour adds 5 minutes, and it keeps counting <u>after</u> the stream starts.</p>\

                    <p>keep shipping = stream neva ends</p>
                </div>

                <Link href="/dashboard" className="btn btn-primary btn-outline btn-xl font-2 ">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
  <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
</svg>
                    <p>Ship now</p>
                </Link>

            </div>

            ) : (

            <>

            <div className="flex mx-auto gap-5 w-5/6 flex-row items-center justify-center">
                <div className="w-3/6 flex flex-col gap-2 h-full">
                    <div className="font-1 text-left flex flex-row align-center">
                        <p className="font-1 mb-4 text-lg"><u>every</u> hour <b className="font-extrabold">building</b> increases the stream by <u className="px-3 py-1 bg-primary text-primary-content font-bold text-xl">5 minutes</u></p>
                    </div>

                    <h1 className="font-2 text-7xl">the livestream don&apos;t stop till you stop <u>shipping</u></h1>

                    <div className="flex-row flex items-center justify-start mt-4 w-full gap-6">



        <Link href="/dashboard" className="btn btn-primary btn-outline btn-xl font-2 ">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
  <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
</svg>

                        <p>Ship now</p>


                    </Link>


                    <a href="https://www.twitch.tv/plastuchino" className="btn btn-secondary btn-ghost btn-xl font-2 ">
                        <FaTwitch />

                        <p>see it all live</p>


                    </a>
                    </div>

                </div>


                <div className="w-3/6 aspect-video">

                    <iframe
                        src={`https://player.twitch.tv/?channel=${TWITCH_CHANNEL}&parent=${hostname}`}
                        allowFullScreen

                        className="w-full h-full"

                    />

                </div>

            </div>

        <div className="">
            <div className="p-4 mt-20 font-2 text-center mx-auto flex flex-col gap-4 w-fit text-4xl border-primary text-center">
                 <p>Time is ticking...</p>
                 <CountdownGrid targetMs={deadline} now={now} />
            </div>


        </div>

            </>

            )}
            <p className="font-2 font-sm">made by seba (plastuchino on da slack)</p>

        </div>



        </section>

        <section className="min-h-[50vh] w-4/6 mx-auto p-5">
            <p className="font-2 my-10 text-3xl">Here&apos;s how it works</p>

            <div className="grid grid-cols-2 gap-y-3 mt-2">
                <div className="bg-base-300 p-4 col-span-2 justify-self-start rounded-box">
                    <h2 className="font-2 text-2xl">find a cool idea</h2>
                    <p className="font-2 mt-2">software, hardware, doesn&apos;t f**king matter</p>
                    {/* <p className="font-2 p-5 w-fit bg-black">1</p> */}

                </div>


<div className="bg-base-300 p-4 col-span-2 justify-self-end rounded-box">
                    <h2 className="font-2 text-2xl">build your cool idea</h2>
                    <p className="font-2 mt-2">if its hardware, we will fund your shit. i dont care.</p>
                    {/* <p className="font-2 p-5 w-fit bg-black">1</p> */}

                </div>


<div className="text-center p-4 col-span-2 border-2 border-primary rounded-box">

                    <h2 className="font-2 text-4xl">get rewarded...<br/>and make me suffer</h2>
                    <p className="font-2 mt-2">as soon as your project gets approved, the stream increases in length<br/>and you can pick something from the <Link href="/shop" className="link text-link text-blue-500">shop</Link></p>
                    {/* <p className="font-2 p-5 w-fit bg-black">1</p> */}

                </div>





            </div>


        </section>

        <section className="p-4 flex flex-col gap-2">

            <p className="text-start w-4/6 mx-auto font-2 text-3xl">FAQ</p>
            <div className="w-4/6 mx-auto flex flex-col gap-2 font-2">
            <div className="collapse bg-base-100 border border-base-300 ">
  <input type="radio" name="my-accordion-1" defaultChecked />
  <div className="collapse-title font-semibold">Who can submit projects</div>
  <div className="collapse-content text-sm">Anyone who&apos;s 13-18.</div>
</div>
<div className="collapse bg-base-100 border border-base-300">
  <input type="radio" name="my-accordion-1" />
  <div className="collapse-title font-semibold">How much does the stream increase per hour shipped?</div>
  <div className="collapse-content text-sm">per hour shipped, the stream increases by 5 minutes.</div>
</div>
<div className="collapse bg-base-100 border border-base-300">
  <input type="radio" name="my-accordion-1" />
  <div className="collapse-title font-semibold">is this legit?</div>
  <div className="collapse-content text-sm">hackclub is a 501c3 organization meaning that our whole job is to give shit out to teenagers that wanna get technical. yes this is legit.</div>
</div>

            </div>

        </section>

        <Footer />




        </>
    )
}
