import { describe, expect, it } from "vitest";

describe("@cave/scenario-engine public entry", () => {
  it("can be imported", async () => {
    await expect(import("./index")).resolves.toBeDefined();
  });
});
