import { describe, expect, it } from "vitest";

import app from "./index";

describe("gateway health route", () => {
  it("returns the versioned health contract", async () => {
    const response = await app.request("/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      contractVersion: "1",
      status: "ok"
    });
  });
});
