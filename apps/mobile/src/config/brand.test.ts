import { brand } from "./brand";

describe("brand", () => {
  it("exposes the canonical product identity", () => {
    expect(brand).toEqual({
      slug: "cave",
      displayName: "内界 CAVE",
      slogan: "听见身体，确认边界。"
    });
  });

  it("is immutable at runtime", () => {
    expect(Object.isFrozen(brand)).toBe(true);
  });
});
