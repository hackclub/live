import assert from "node:assert/strict";
import test from "node:test";
import * as submission from "./submission.ts";

const validHardwareSubmission: Omit<submission.SubmissionInput, "workLogType"> = {
  track: "hardware",
  codeUrl: "https://github.com/example/project",
  playableUrl: "https://example.com/project",
  description: "A hardware project",
  lapseLinks: "https://example.com/work-log",
  addressLine1: "123 Main Street",
  addressLine2: "",
  city: "Toronto",
  state: "Ontario",
  country: "Canada",
  zip: "A1A 1A1",
  birthday: "2009-01-01",
  hackatimeProject: "",
  hardwareHours: "4.5",
};

test("hardware submissions reject a missing work-log type", () => {
  const errors = submission.validateSubmissionInput(validHardwareSubmission);

  assert.equal(errors.workLogType, "Choose Lapse or Git Journal");
});

test("hardware submissions reject an unsupported work-log type", () => {
  const errors = submission.validateSubmissionInput({
    ...validHardwareSubmission,
    workLogType: "spreadsheet",
  } as unknown as Parameters<typeof submission.validateSubmissionInput>[0]);

  assert.equal(errors.workLogType, "Choose Lapse or Git Journal");
});

test("stored Git Journal values retain their type", () => {
  assert.equal(submission.parseWorkLogType("Git Journal"), "Git Journal");
  assert.equal(submission.parseWorkLogType("unsupported"), null);
});

test("Git Journal selection produces Git Journal form copy", () => {
  assert.deepEqual(submission.getWorkLogCopy("Git Journal"), {
    label: "Git Journal Link",
    placeholder: "Required for Git Journal submissions",
  });
});

test("software submissions clear a previously stored work-log type", () => {
  assert.equal(submission.workLogTypeForAirtable("hardware", "Git Journal"), "Git Journal");
  assert.equal(submission.workLogTypeForAirtable("software", "Git Journal"), null);
});
