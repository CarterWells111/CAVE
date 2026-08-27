import { describe, expect, it } from "vitest";

describe("@cave/contracts public entry", () => {
  it("can be imported", async () => {
    await expect(import("./index")).resolves.toBeDefined();
  });
});
