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
export function validateSubmissionInput(input: Partial<SubmissionInput>): SubmissionFieldErrors {
  const errors: SubmissionFieldErrors = {};

  for (const [key, message] of COMMON_REQUIRED_FIELDS) {
    const value = input[key];
    if (!value || !String(value).trim()) {
      errors[key] = message;
    }
  }

  if (input.track === "hardware") {
    if (!input.lapseLinks || !input.lapseLinks.trim()) {
      errors.lapseLinks = "Lapse Link is required for hardware submissions";
    }
    const hours = Number(input.hardwareHours);
    if (!input.hardwareHours || Number.isNaN(hours) || hours <= 0) {
      errors.hardwareHours = "Enter the hours spent on this project";
    }
  } else {
    if (!input.hackatimeProject || !input.hackatimeProject.trim()) {
      errors.hackatimeProject = "Select the Hackatime project this submission tracks hours under";
    }
  }

  return errors;
}

export function hasErrors(errors: SubmissionFieldErrors): boolean {
  return Object.values(errors).some(Boolean);
}
