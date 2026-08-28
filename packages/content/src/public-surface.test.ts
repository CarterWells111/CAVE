import { describe, expect, it } from "vitest";

import { JOURNEY_SOURCE_REGISTRY } from "./index";

describe("@cave/content public surface", () => {
  it("exports the complete source-verified journey registry", () => {
    expect(JOURNEY_SOURCE_REGISTRY).toHaveLength(14);

    const ids = JOURNEY_SOURCE_REGISTRY.map((source) => source.id);
    expect(new Set(ids).size).toBe(ids.length);

    expect(
      JOURNEY_SOURCE_REGISTRY.every(
        (source) => source.verificationStatus === "source_verified"
      )
    ).toBe(true);
  });

  it("keeps SRC-011 on the verified national geographic information source", () => {
    expect(JOURNEY_SOURCE_REGISTRY.find((source) => source.id === "SRC-011")).toEqual({
      id: "SRC-011",
      sourceType: "SAFE",
      title: "天地图助力12338妇联维权服务中心地图上线",
      organization: "国家基础地理信息中心",
      url: "https://www.ngcc.cn/xwzx/ywcg/202506/t20250617_2538.html",
      appliesTo: "中国大陆所在地 12338 妇女维权热线及线下服务中心入口",
      publicationOrReviewDate: "2025-06-17",
      accessedAt: "2026-08-28",
      verificationStatus: "source_verified"
    });
  });
});
