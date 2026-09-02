export type SubmissionFieldErrors = Partial<Record<string, string>>;

export type SubmissionTrack = "software" | "hardware";

export const WORK_LOG_TYPES = {
  lapse: "Lapse",
  gitJournal: "Git Journal",
} as const;

export type WorkLogType = (typeof WORK_LOG_TYPES)[keyof typeof WORK_LOG_TYPES];

export function parseWorkLogType(value: unknown): WorkLogType | null {
  return value === WORK_LOG_TYPES.lapse || value === WORK_LOG_TYPES.gitJournal ? value : null;
}

export function getWorkLogCopy(type: WorkLogType): { label: string; placeholder: string } {
  if (type === WORK_LOG_TYPES.gitJournal) {
    return {
      label: "Git Journal Link",
      placeholder: "Required for Git Journal submissions",
    };
  }

  return {
    label: "Lapse Link",
    placeholder: "Required for Lapse submissions",
  };
}

export function parseStoredWorkLog(value: unknown): { type: WorkLogType; link: string } {
  const stored = typeof value === "string" ? value.trim() : "";

  for (const type of Object.values(WORK_LOG_TYPES)) {
    const prefix = `${type}:`;
    if (stored.startsWith(prefix)) {
      return { type, link: stored.slice(prefix.length).trim() };
    }
  }

  return { type: WORK_LOG_TYPES.lapse, link: stored };
}

export function workLogForAirtable(
  track: SubmissionTrack,
  type: WorkLogType | undefined,
  link: string | undefined,
): string | null {
  if (track !== "hardware" || !type) return null;
  return `${type}: ${(link ?? "").trim()}`;
}

export type SubmissionInput = {
  track: SubmissionTrack;
  workLogType: WorkLogType;
  codeUrl: string;
  playableUrl: string;
  description: string;
  lapseLinks: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  zip: string;
  birthday: string;
  hackatimeProject: string;
  hardwareHours: string;
};

const COMMON_REQUIRED_FIELDS: Array<[keyof SubmissionInput, string]> = [
  ["codeUrl", "Code URL is required"],
  ["playableUrl", "Playable URL is required"],
  ["description", "Description is required"],
  ["addressLine1", "Address is required"],
  ["city", "City is required"],
  ["state", "State / Province is required"],
  ["country", "Country is required"],
  ["zip", "ZIP / Postal Code is required"],
  ["birthday", "Birthday is required"],
];

// Server-side validation is authoritative — this same function is called
// from the API route regardless of what client-side validation already did.
// Screenshot is validated separately by the caller since it's a File, not a
// string field. Which fields are required beyond the common set depends on
// the track: Software needs a Hackatime project; Hardware needs a work-log
// type, a matching link, and a self-reported hours number instead.
export function validateSubmissionInput(input: Partial<SubmissionInput>): SubmissionFieldErrors {
  const errors: SubmissionFieldErrors = {};

  for (const [key, message] of COMMON_REQUIRED_FIELDS) {
    const value = input[key];
    if (!value || !String(value).trim()) {
      errors[key] = message;
    }
  }

  if (input.track === "hardware") {
    if (!parseWorkLogType(input.workLogType)) {
      errors.workLogType = "Choose Lapse or Git Journal";
    }
    if (!input.lapseLinks || !input.lapseLinks.trim()) {
      errors.lapseLinks = "A Lapse or Git Journal link is required for hardware submissions";
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
