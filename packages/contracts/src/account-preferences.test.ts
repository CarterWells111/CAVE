import { describe, expect, it } from "vitest";
import * as contracts from "./index";

const request = {
  contractVersion: "1", requestId: "7cbbc0f9-9d12-4b08-9741-75bbb399e7c6",
  expectedRevision: 0, changes: { ageConfirmed: true },
};

describe("account preferences contracts", () => {
  it("exports strict preference and revision contracts", () => {
    expect(contracts).toHaveProperty("AccountPreferencesSchema");
    expect(contracts.AccountPreferencesSchema.safeParse({ ageConfirmed: false, addressPreference: null, updatedAt: null, revision: 0 }).success).toBe(true);
    expect(contracts.AccountPreferencesResponseSchema.safeParse({ contractVersion: "1", requestId: request.requestId, preferences: { ageConfirmed: true, addressPreference: "妳", updatedAt: "2026-09-04T12:00:00.000Z", revision: 1 } }).success).toBe(true);
  });

  it("accepts either field including false and null", () => {
    for (const changes of [{ ageConfirmed: false }, { addressPreference: null }, { addressPreference: "你" }, { ageConfirmed: true, addressPreference: "妳" }]) {
      expect(contracts.UpdateAccountPreferencesRequestSchema.safeParse({ ...request, changes }).success).toBe(true);
    }
  });

  it("rejects empty, unknown, identity and malformed fields", () => {
    for (const input of [
      { ...request, changes: {} }, { ...request, changes: { ageConfirmed: "true" } },
      { ...request, changes: { addressPreference: "other" } },
      { ...request, changes: { ageConfirmed: true, accountId: "other" } },
      { ...request, accountId: "other" }, { ...request, expectedRevision: -1 },
      { ...request, expectedRevision: 0.5 }, { ...request, requestId: "bad" },
    ]) expect(contracts.UpdateAccountPreferencesRequestSchema.safeParse(input).success).toBe(false);
    expect(contracts.ApiErrorCodeSchema.safeParse("ACCOUNT_PREFERENCES_CONFLICT").success).toBe(true);
  });
});
