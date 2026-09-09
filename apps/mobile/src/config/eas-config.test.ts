import easConfig from "../../eas.json";

describe("EAS build profiles", () => {
  it("uses a development client with internal distribution", () => {
    expect(easConfig.build.development).toMatchObject({
      developmentClient: true,
      distribution: "internal"
    });
  });

  it("uses internal preview distribution on the preview channel", () => {
    expect(easConfig.build.preview).toMatchObject({
      node: "22.23.2",
      channel: "preview",
      distribution: "internal"
    });
  });

  it("keeps fault tooling exclusive to the explicit acceptance development profile", () => {
    expect(easConfig.build.acceptance).toEqual({ extends: "development", env: { CAVE_ACCEPTANCE_TOOLS: "1" } });
    expect(easConfig.build.development.node).toBe("22.23.2");
  });

  it("configures production without triggering a build", () => {
    expect(easConfig.build.production).toMatchObject({
      channel: "production"
    });
  });
});

test.each(["development", "preview", "production"] as const)("%s explicitly uses the shared live gateway", profile => {
  expect(easConfig.build[profile].env).toEqual({
    EXPO_PUBLIC_GATEWAY_URL: "https://api.neijiecave.com",
    EXPO_PUBLIC_ASSISTANT_MODE: "live",
  });
});