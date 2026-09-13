export type SubmissionFieldErrors = Partial<Record<string, string>>;

export type SubmissionTrack = "software" | "hardware";

export type SubmissionInput = {
  track: SubmissionTrack;
  codeUrl: string;
  playableUrl: string;
  description: string;
  lapseLinks: string;
  hackatimeProject: string;
  hardwareHours: string;
};

// Address (Line 1/2), City, State/Province, Country, ZIP, and Birthday are
// deliberately absent: they're sourced server-side from the HCA identity, not
// the form, so there's no client value to validate.
const COMMON_REQUIRED_FIELDS: Array<[keyof SubmissionInput, string]> = [
  ["codeUrl", "Code URL is required"],
  ["playableUrl", "Playable URL is required"],
  ["description", "Description is required"],
];

// Server-side validation is authoritative — this same function is called
// from the API route regardless of what client-side validation already did.
// Screenshot is validated separately by the caller since it's a File, not a
// string field. Which fields are required beyond the common set depends on
// the track: Software needs a Hackatime project; Hardware needs a Lapse
// Link and a self-reported hours number instead.
function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function allHttpUrls(value: string): boolean {
  const parts = value.split(",").map((part) => part.trim());
  return parts.every((part) => part.length > 0 && isHttpUrl(part));
}

export function validateSubmissionInput(input: Partial<SubmissionInput>): SubmissionFieldErrors {
  const errors: SubmissionFieldErrors = {};

  for (const [key, message] of COMMON_REQUIRED_FIELDS) {
    const value = input[key];
    if (!value || !String(value).trim()) {
      errors[key] = message;
    }
  }

  for (const key of ["codeUrl", "playableUrl"] as const) {
    const value = input[key];
    if (value?.trim() && !isHttpUrl(value)) {
      errors[key] = "Enter a valid http(s) URL";
    }
  }

  if (input.track === "hardware") {
    if (!input.lapseLinks || !input.lapseLinks.trim()) {
      errors.lapseLinks = "Lapse Link is required for hardware submissions";
    } else if (!allHttpUrls(input.lapseLinks)) {
      errors.lapseLinks = "Enter comma-separated http(s) links";
    }
    const hours = Number(input.hardwareHours);
    if (!input.hardwareHours || Number.isNaN(hours) || hours <= 0) {
      errors.hardwareHours = "Enter the hours spent on this project";
    }
  } else {
    if (!input.hackatimeProject || !input.hackatimeProject.trim()) {
      errors.hackatimeProject = "Select the Hackatime project this submission tracks hours under";
    }
    if (input.lapseLinks?.trim() && !allHttpUrls(input.lapseLinks)) {
      errors.lapseLinks = "Enter comma-separated http(s) links";
    }
  }

  return errors;
}

export function hasErrors(errors: SubmissionFieldErrors): boolean {
  return Object.values(errors).some(Boolean);
}
