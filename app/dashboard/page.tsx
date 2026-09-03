import { requireSession } from "../../src/lib/auth";
import {
  countPaidReferralsForHandle,
  getPersonalApprovedHours,
  getReferralByRefereeEmail,
  listMessagesBySubmissionIds,
  listRedemptionsByEmail,
  listSubmissionsByEmail,
  REDEMPTION_FIELDS,
  REFERRAL_FIELDS,
  SUBMISSION_FIELDS,
  upsertReferralResolution,
} from "../../src/lib/airtable";
import { getIdentity } from "../../src/lib/hackclub";
import Link from "next/link";
import Footer from "../components/Footer";
import { getHackatimeMe, getHackatimeProjects, trackedHoursForProject } from "../../src/lib/hackatime";
import SubmissionForm from "../components/dashboard/SubmissionForm";
import SubmissionsList, { type OwnSubmission } from "../components/dashboard/SubmissionsList";
import PurchasedPrizes, { type Redemption } from "../components/dashboard/PurchasedPrizes";
import ReferralPanel from "../components/dashboard/ReferralPanel";

export default async function DashboardPage() {
  // Redirects to /api/auth/login or /api/auth/hackatime/login if either
  // piece is missing — by the time this renders, both tokens are present.
  const session = await requireSession();

  const identity = await getIdentity(session.access_token);
  if (!identity?.primary_email) {
    return (
      <section className="w-4/6 mx-auto min-h-screen py-10">
        <p className="text-error">Couldn&apos;t load your Hack Club identity. Try logging in again.</p>
      </section>
    );
  }
 
  const [hackatimeMe, hackatimeProjects, ownRecords, personalHours, redemptionRecords] = await Promise.all([
    getHackatimeMe(session.hackatime_access_token!),
    getHackatimeProjects(session.hackatime_access_token!),
    listSubmissionsByEmail(identity.primary_email),
    getPersonalApprovedHours(identity.primary_email),
    listRedemptionsByEmail(identity.primary_email),
  ]);

  const redemptions: Redemption[] = redemptionRecords.map((record) => ({
    id: record.id,
    itemName: String(record.fields[REDEMPTION_FIELDS.itemName] ?? ""),
    cost: Number(record.fields[REDEMPTION_FIELDS.cost] ?? 0),
    redeemedAt: String(record.fields[REDEMPTION_FIELDS.redeemedAt] ?? ""),
  }));
   console.log("personal: " +personalHours)
  const projectOptions = hackatimeProjects
    .filter((p) => !p.archived)
    .map((p) => ({ name: p.name, hours: trackedHoursForProject(p) }));

  const messagesBySubmission = await listMessagesBySubmissionIds(ownRecords.map((r) => r.id));

  // Referral section: keep the handle -> email map fresh, then read this
  // user's own referrer (if any) and how many people they've referred who
  // shipped. All best-effort — a missing Referrals table shouldn't 500 the
  // dashboard.
  const githubUsername = hackatimeMe?.github_username?.trim() || "";
  const [referralRow, referredCount] = await Promise.all([
    getReferralByRefereeEmail(identity.primary_email).catch(() => null),
    githubUsername
      ? countPaidReferralsForHandle(githubUsername).catch(() => 0)
      : Promise.resolve(0),
  ]);
  if (githubUsername) {
    try {
      await upsertReferralResolution(githubUsername, identity.primary_email);
    } catch (err) {
      console.warn("[referral] upsertReferralResolution failed", err);
    }
  }
  const referrerHandle = referralRow
    ? String(referralRow.fields[REFERRAL_FIELDS.referrerHandle] ?? "") || null
    : null;

  const submissions: OwnSubmission[] = ownRecords.map((record) => {
      const hackatimeProjectName = String(record.fields[SUBMISSION_FIELDS.hackatimeProjects] ?? "");
      return {
        id: record.id,
        track: hackatimeProjectName ? "software" : "hardware",
        codeUrl: String(record.fields[SUBMISSION_FIELDS.codeUrl] ?? ""),
        playableUrl: String(record.fields[SUBMISSION_FIELDS.playableUrl] ?? ""),
        lapseLinks: String(record.fields[SUBMISSION_FIELDS.lapseLinks] ?? ""),
        hours: Number(record.fields[SUBMISSION_FIELDS.overrideHours] ?? 0),
        approved: Boolean(record.fields[SUBMISSION_FIELDS.approved]),
        reviewStatus: String(record.fields[SUBMISSION_FIELDS.reviewStatus] ?? "Pending"),
        messages: messagesBySubmission.get(record.id) ?? [],
        defaults: {
          description: String(record.fields[SUBMISSION_FIELDS.description] ?? ""),
          addressLine1: String(record.fields[SUBMISSION_FIELDS.addressLine1] ?? ""),
          addressLine2: String(record.fields[SUBMISSION_FIELDS.addressLine2] ?? ""),
          city: String(record.fields[SUBMISSION_FIELDS.city] ?? ""),
          state: String(record.fields[SUBMISSION_FIELDS.state] ?? ""),
          country: String(record.fields[SUBMISSION_FIELDS.country] ?? ""),
          zip: String(record.fields[SUBMISSION_FIELDS.zip] ?? ""),
          birthday: String(record.fields[SUBMISSION_FIELDS.birthday] ?? ""),
          hardwareHours: hackatimeProjectName ? "" : String(record.fields[SUBMISSION_FIELDS.overrideHours] ?? ""),
        },
      };
    });

  return (
    <>
      <div className="w-5/6 mx-auto grid grid-cols-2 gap-8 p-10">
        <section className="p-3 bg-base-300 border-secondary border">
          <p className="font-2 text-2xl">
            howdy <span className="text-primary text-3xl">{identity.first_name ?? "person!"}</span>
          </p>
          <p className="font-1 pt-5 text-lg">
            this is da place where you can submit to increase the stream length (and receive cool prizes)
          </p>

          <p className="py-5 font-2">
            You&apos;ve personally increased the stream by{" "}
            <span className="text-primary font-bold">{(personalHours * 20).toFixed(1)} minutes</span>


          </p>
          <div className="">
            {Number(personalHours) < 1 ? 
            
            <>
            <p>You have {personalHours.toFixed(1)} tokens. lock in to earn some</p>  
            </> : 
            <div className="font-2 flex flex-row items-center gap-2">
              <p>You have {personalHours.toFixed(1)} tokens. let&apos;s go </p>
              <Link className="link text-blue-500" href="/redeem">spend em!</Link>
            </div>
            
              
              }
          
          </div>
               <div className=" mx-auto pt-8 border-t-2 flex flex-col gap-4">
        <p className="text-lg font-2">Your Submissions</p>
        <SubmissionsList
          submissions={submissions}
          githubUsername={hackatimeMe?.github_username ?? ""}
          hackatimeProjects={projectOptions}
        />
      </div>

      <div>
        <p className="font-2 text-lg mt-4">Check out da shop</p>
        <p className="text-xs font-2">you can pr shop items that you want <a className="link text-blue-500" href="https://github.com/hackclub/live">here.</a></p>

        <Link href="/redeem" className="btn btn-secondary font-2 mt-3 w-full btn-xl">buy now!</Link>
        <p className="font-2 text-sm">i made the button extra big so you cant miss it :)</p>
      </div>

      <div className="pt-6 border-t-2 mt-4 flex flex-col gap-2">
        <p className="font-2 text-lg">Your Prizes</p>
        <PurchasedPrizes redemptions={redemptions} />
      </div>

      <ReferralPanel
        handle={githubUsername}
        referrerHandle={referrerHandle}
        hasSubmissions={ownRecords.length > 0}
        referredCount={referredCount}
      />
        </section>

        <section className="mx-auto flex flex-col gap-4">
          <p className="text-2xl font-2">submit a new project</p>
          <SubmissionForm githubUsername={hackatimeMe?.github_username ?? ""} hackatimeProjects={projectOptions} />
        </section>
      </div>

   

      <Footer />
    </>
  );
}
