import { describe, expect, it } from "vitest";
import { confirmedVersionUpload } from "../scripts/gateway-release.mjs";

const sha = "a".repeat(40);
const accountId = "1".repeat(32);
const worker = "test-gateway";
const id = "11111111-1111-1111-1111-111111111111";
const version = { id, annotations: { "workers/tag": sha }, metadata: { created_on: "2026-10-04T22:00:00Z" } };
const completed = { status: 0, signal: null, stdout: "Uploaded " + worker + " (4 sec)\nWorker Version ID: " + id + "\n", stderr: "" };
const previewFailure = {
  ...completed, status: 1,
  stderr: "\u001b[31m✘ [ERROR]\u001b[0m A request to the Cloudflare API (/accounts/" + accountId + "/workers/subdomain) failed.\nAuthentication error [code: 10000]\n",
};

describe("completed Worker upload confirmation", () => {
  it("requires the CLI-reported version to match the remote accepted commit even on success", () => {
    expect(confirmedVersionUpload(completed, [version], sha, accountId, worker)).toBe(id);
  });

  it("accepts only the known post-upload preview permission failure with an independently confirmed version", () => {
    expect(confirmedVersionUpload(previewFailure, [version], sha, accountId, worker)).toBe(id);
    expect(() => confirmedVersionUpload(previewFailure, [], sha, accountId, worker)).toThrow();
    expect(() => confirmedVersionUpload(previewFailure, [{ ...version, annotations: { "workers/tag": "b".repeat(40) } }], sha, accountId, worker)).toThrow();
    expect(() => confirmedVersionUpload(previewFailure, [{ ...version, id: "22222222-2222-2222-2222-222222222222" }], sha, accountId, worker)).toThrow();
  });

  it("handles ANSI styling around the completed version marker", () => {
    const colored = { ...previewFailure, stdout: completed.stdout.replace(id, "\u001b[32m" + id + "\u001b[0m") };
    expect(confirmedVersionUpload(colored, [version], sha, accountId, worker)).toBe(id);
  });

  it("handles the known preview diagnostic on either output stream", () => {
    const onStdout = { ...previewFailure, stdout: completed.stdout + previewFailure.stderr, stderr: "" };
    expect(confirmedVersionUpload(onStdout, [version], sha, accountId, worker)).toBe(id);
  });

  it.each([
    { stdout: "" },
    { stdout: completed.stdout + "Worker Version ID: " + id },
    { stdout: completed.stdout.replace(worker, "other-worker") },
    { status: null, signal: "SIGTERM" },
    { status: 2 },
    { stderr: previewFailure.stderr.replace("workers/subdomain", "workers/scripts/" + worker + "/versions") },
    { stderr: previewFailure.stderr.replace(accountId, "2".repeat(32)) },
    { stderr: previewFailure.stderr.replace("10000", "10013") },
    { stderr: previewFailure.stderr + "\n[ERROR] Another upload failure" },
  ])("rejects other errors, interruptions and unconfirmed uploads: %j", (patch) => {
    expect(() => confirmedVersionUpload({ ...previewFailure, ...patch }, [version], sha, accountId, worker)).toThrow();
  });
});
