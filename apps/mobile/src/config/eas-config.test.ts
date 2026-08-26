import easConfig from "../../eas.json";

describe("EAS build profiles", () => {
  it("uses a development client with internal distribution", () => {
    expect(easConfig.build.development).toMatchObject({
      developmentClient: true,
      distribution: "internal"
    });
  });

  it("uses internal preview distribution on the preview channel", () => {
    expect(easConfig.build.preview).toEqual({
      channel: "preview",
      distribution: "internal"
    });
  });

  it("configures production without triggering a build", () => {
    expect(easConfig.build.production).toEqual({
      channel: "production"
    });
  });
});
