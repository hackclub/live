"use client";

import { useState } from "react";
import SubmissionForm from "./SubmissionForm";
import MessageThread, { type ThreadMessage } from "./MessageThread";
import type { WorkLogType } from "../../../src/lib/submission";

export type OwnSubmission = {
  id: string;
  track: "software" | "hardware";
  codeUrl: string;
  playableUrl: string;
  lapseLinks: string;
  workLogType: WorkLogType;
  hours: number;
  approved: boolean;
  reviewStatus: string;
  messages: ThreadMessage[];
  defaults: {
    description: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    country: string;
    zip: string;
    birthday: string;
    hardwareHours: string;
  };
};

export default function SubmissionsList({
  submissions,
  githubUsername,
  hackatimeProjects,
}: {
  submissions: OwnSubmission[];
  githubUsername: string;
  hackatimeProjects: { name: string; hours: number }[];
}) {
  const [editing, setEditing] = useState<string | null>(null);

  if (submissions.length === 0) {
    return <p className="opacity-60">You haven&apos;t submitted a project yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {submissions.map((s) => (
        <div key={s.id} className="bg-base-200 p-4 gap-2 border">
          <div className="flex justify-between items-start flex-wrap gap-2">
            <div className="flex flex-col gap-1 text-sm">
              <p className="text-accent font-2 text-3xl">{s.hours.toFixed(1)}h</p>
              <div className="flex flex-row items-center gap-2">
                <p className="font-bold badge badge-secondary font-2">{s.approved ? "Approved" : s.reviewStatus}</p>
                <span className="badge badge-primary font-2">{s.track}</span>
                
              </div>
              
              <a className="btn btn-secondary btn-ghost font-2 btn-sm w-fit" href={s.codeUrl} target="_blank" rel="noreferrer">
                Code URL
              </a>
              <a className="btn btn-secondary btn-ghost font-2 btn-sm w-fit" href={s.playableUrl} target="_blank" rel="noreferrer">
                Playable URL
              </a>
              {s.lapseLinks && <a className="font-2">{s.workLogType}: {s.lapseLinks}</a>}
              
         

          
            </div>

            {(!s.approved) && (
              <button className="btn btn-sm" onClick={() => setEditing(editing === s.id ? null : s.id)}>
              {editing === s.id ? "Close" : "Fix & resubmit"}
            </button>

            )}
   
          </div>

          {editing === s.id && (
            <div className="pt-2">
              <SubmissionForm
                githubUsername={githubUsername}
                hackatimeProjects={hackatimeProjects}
                recordId={s.id}
                defaults={{
                  track: s.track,
                  codeUrl: s.codeUrl,
                  playableUrl: s.playableUrl,
                  lapseLinks: s.lapseLinks,
                  workLogType: s.workLogType,
                  ...s.defaults,
                }}
                onSaved={() => setEditing(null)}
              />
            </div>
          )}

          <details className="mt-2 font-2">
            <summary className="cursor-pointer text-sm opacity-70">Messages</summary>
            <div className="pt-2">
              <MessageThread messages={s.messages} />
            </div>
          </details>
        </div>
      ))}
    </div>
  );
}
