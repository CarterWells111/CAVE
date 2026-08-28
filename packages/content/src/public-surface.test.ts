import { describe, expect, it } from "vitest";

import { JOURNEY_SOURCE_REGISTRY } from "./index";

describe("@cave/content public surface", () => {
  it("exports the complete source-verified journey registry", () => {
    expect(JOURNEY_SOURCE_REGISTRY).toHaveLength(13);

    const ids = JOURNEY_SOURCE_REGISTRY.map((source) => source.id);
    expect(new Set(ids).size).toBe(ids.length);

    expect(
      JOURNEY_SOURCE_REGISTRY.every(
        (source) => source.verificationStatus === "source_verified"
      )
    ).toBe(true);
  });
});
