import { describe, expect, it } from "vitest";

describe("@hackathon/test-fixtures public entry", () => {
  it("can be imported", async () => {
    await expect(import("./index")).resolves.toBeDefined();
  });
});
