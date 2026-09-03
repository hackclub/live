import { NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../src/lib/auth";
import {
  createAirtableRecord,
  createMessage,
  deleteAirtableRecord,
  getSubmissionById,
  MESSAGE_SENDER,
  REVIEW_STATUS,
  SUBMISSION_FIELDS,
  updateAirtableRecord,
  uploadAirtableAttachment,
} from "../../../src/lib/airtable";
import {
  getIdentity,
  isIdentityCompleteForSubmission,
  mapIdentityAddress,
  normalizeBirthdate,
} from "../../../src/lib/hackclub";
import { getHackatimeMe, getHackatimeProjects, trackedHoursForProject } from "../../../src/lib/hackatime";
import { validateSubmissionInput, type SubmissionInput } from "../../../src/lib/submission";

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session?.access_token || !session.hackatime_access_token) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const identity = await getIdentity(session.access_token);
  if (!identity?.primary_email) {
    return NextResponse.json({ error: "identity_unavailable" }, { status: 401 });
  }

  // Address + birthday come from the HCA identity, never the form. If the
  // identity isn't verified or is missing either, there's nothing to write —
  // block before touching Airtable (mirrors "fully succeeds or fails loudly").
  if (!isIdentityCompleteForSubmission(identity)) {
    return NextResponse.json({ error: "identity_incomplete" }, { status: 409 });
  }
  const identityAddress = mapIdentityAddress(identity)!;
  const identityBirthday = normalizeBirthdate(identity.birthdate)!;

  const formData = await request.formData();
  const recordId = String(formData.get("recordId") ?? "").trim() || null;
  const updateNote = String(formData.get("updateNote") ?? "").trim();
  const track = formData.get("track") === "hardware" ? "hardware" : "software";
  const input: Partial<SubmissionInput> = {
    track,
    codeUrl: String(formData.get("codeUrl") ?? ""),
    playableUrl: String(formData.get("playableUrl") ?? ""),
    description: String(formData.get("description") ?? ""),
    lapseLinks: String(formData.get("lapseLinks") ?? ""),
    hackatimeProject: String(formData.get("hackatimeProject") ?? ""),
    hardwareHours: String(formData.get("hardwareHours") ?? ""),
  };
  // NOTE: addressLine1/city/state/country/zip/birthday are intentionally NOT
  // read from the form — they're sourced from the HCA identity above and any
  // values in the request body are ignored.
  const screenshot = formData.get("screenshot");

  // A recordId means "fix and resubmit this specific project" — fetch it
  // and verify it actually belongs to this person before touching it. No
  // recordId always means a brand new submission; a person can have any
  // number of these.
  let existing = null;
  if (recordId) {
    existing = await getSubmissionById(recordId);
    if (!existing || existing.fields[SUBMISSION_FIELDS.email] !== identity.primary_email) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
  }

  // A left-blank <input type="file"> still submits a File in FormData —
  // just a zero-byte one (name: "", size: 0), never null/undefined — so
  // presence alone can't distinguish "no screenshot chosen" from a real one.
  const hasScreenshot = screenshot instanceof File && screenshot.size > 0;

  const fieldErrors = validateSubmissionInput(input);
  if (!existing && !hasScreenshot) {
    fieldErrors.screenshot = "Screenshot is required";
  }
  if (Object.values(fieldErrors).some(Boolean)) {
    return NextResponse.json({ error: "validation_failed", fieldErrors }, { status: 400 });
  }

  // Hackatime identity (GitHub username, Hackatime ID for the Telescreen
  // Link) is fetched regardless of track — the user connected Hackatime at
  // login either way. Only the *project list* is Software-only.
  const hackatimeMe = await getHackatimeMe(session.hackatime_access_token);

  let hours: number;
  let hackatimeProjectName = "";

  if (track === "software") {
    // Hours are re-derived server-side from a fresh Hackatime call — never
    // trusted from client input.
    const hackatimeProjects = await getHackatimeProjects(session.hackatime_access_token);
    const selectedProject = hackatimeProjects.find((project) => project.name === input.hackatimeProject);
    if (!selectedProject) {
      return NextResponse.json(
        {
          error: "validation_failed",
          fieldErrors: { hackatimeProject: "Selected project was not found in your Hackatime account" },
        },
        { status: 400 },
      );
    }
    hours = trackedHoursForProject(selectedProject);
    hackatimeProjectName = selectedProject.name;
  } else {
    // Hardware submissions have no Hackatime project, so the self-reported
    // hours value (already validated as a positive number) is used as-is.
    hours = Number(input.hardwareHours);
  }

  // NOTE: Hackatime's `/me` response shape hasn't been verified live yet
  // (see design.md Open Questions) — falls back through the identifiers
  // most likely to be present. Airtable's `typecast: false` rejects a
  // non-string value for a text field outright (this is what caused the
  // 422 INVALID_VALUE_FOR_COLUMN on this field), so every candidate is
  // coerced to a string explicitly rather than relying on `??` to produce one.
  const hackatimeIdRaw =
    (hackatimeMe as unknown as { id?: unknown; username?: unknown })?.id ??
    (hackatimeMe as unknown as { username?: unknown })?.username ??
    hackatimeMe?.github_username ??
    "";
  const hackatimeId = hackatimeIdRaw === null || hackatimeIdRaw === undefined ? "" : String(hackatimeIdRaw);
  if (!hackatimeId) {
    console.error("[submit] no usable Hackatime ID found on /me response:", JSON.stringify(hackatimeMe).slice(0, 2000));
  }

  const fields: Record<string, unknown> = {
    [SUBMISSION_FIELDS.codeUrl]: input.codeUrl,
    [SUBMISSION_FIELDS.playableUrl]: input.playableUrl,
    [SUBMISSION_FIELDS.description]: input.description,
    [SUBMISSION_FIELDS.lapseLinks]: input.lapseLinks || undefined,
    [SUBMISSION_FIELDS.firstName]: identity.first_name ?? "",
    [SUBMISSION_FIELDS.lastName]: identity.last_name ?? "",
    [SUBMISSION_FIELDS.email]: identity.primary_email,
    [SUBMISSION_FIELDS.githubUsername]: hackatimeMe?.github_username ?? "",
    [SUBMISSION_FIELDS.addressLine1]: identityAddress.addressLine1,
    [SUBMISSION_FIELDS.addressLine2]: identityAddress.addressLine2 || undefined,
    [SUBMISSION_FIELDS.city]: identityAddress.city,
    [SUBMISSION_FIELDS.state]: identityAddress.state,
    [SUBMISSION_FIELDS.country]: identityAddress.country,
    [SUBMISSION_FIELDS.zip]: identityAddress.zip,
    [SUBMISSION_FIELDS.birthday]: identityBirthday,
    [SUBMISSION_FIELDS.hackatimeId]: hackatimeId,
    [SUBMISSION_FIELDS.hackatimeProjects]: hackatimeProjectName || undefined,
    // This is system-computed for Software (never user input) and the
    // validated self-report for Hardware — either way it's the single
    // source of truth for that record's hours.
    [SUBMISSION_FIELDS.overrideHours]: Math.round(hours * 10) / 10,
    [SUBMISSION_FIELDS.reviewStatus]: REVIEW_STATUS.pending,
  };

  let record;
  try {
    if (existing) {
      record = await updateAirtableRecord(existing.id, fields);
    } else {
      record = await createAirtableRecord(fields);
    }
  } catch (err) {
    console.error("[submit] Airtable record write failed", err);
    return NextResponse.json({ error: "airtable_write_failed" }, { status: 502 });
  }

  if (hasScreenshot) {
    try {
      await uploadAirtableAttachment({
        recordId: record.id,
        fieldName: SUBMISSION_FIELDS.screenshot,
        file: screenshot as File,
      });
    } catch (err) {
      console.error("[submit] screenshot upload failed", err);
      // A submission either fully succeeds or fails loudly — no partial
      // records. Only roll back (delete) a record we just created; an
      // update-in-place failure leaves the prior good record intact.
      if (!existing) {
        await deleteAirtableRecord(record.id).catch(() => {});
      }
      return NextResponse.json({ error: "screenshot_upload_failed" }, { status: 502 });
    }
  }

  // A resubmission's note is logged the same way an admin's rejection
  // reason is — as a message tied to this specific ship, not a free-standing
  // chat send. Only meaningful on a resubmission (existing record); a brand
  // new submission has nothing to compare against yet.
  if (existing && updateNote) {
    await createMessage({
      submissionRecordId: record.id,
      sender: MESSAGE_SENDER.submitter,
      message: updateNote,
    });
  }

  return NextResponse.json({ ok: true, recordId: record.id });
}
