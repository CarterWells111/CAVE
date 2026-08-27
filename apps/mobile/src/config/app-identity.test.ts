import type { ConfigContext } from "expo/config";

import getConfig from "../../app.config";

const originalBuildProfile = process.env.EAS_BUILD_PROFILE;

function configFor(profile: string) {
  process.env.EAS_BUILD_PROFILE = profile;

  return getConfig({ config: {} } as ConfigContext);
}

afterEach(() => {
  if (originalBuildProfile === undefined) {
    delete process.env.EAS_BUILD_PROFILE;
  } else {
    process.env.EAS_BUILD_PROFILE = originalBuildProfile;
  }
});

describe("Expo app identity", () => {
  test.each([
    ["development", "内界 CAVE Dev"],
    ["preview", "内界 CAVE Preview"],
    ["production", "内界 CAVE"]
  ])("uses the %s display name", (profile, expectedName) => {
    expect(configFor(profile).name).toBe(expectedName);
  });

  test("uses the shared app identity", () => {
    const config = configFor("production");

    expect(config.owner).toBe("carter_wells");
    expect(config.slug).toBe("cave");
    expect(config.version).toBe("0.1.0");
    expect(config.scheme).toBe("cave");
    expect(config.ios?.bundleIdentifier).toBe("com.neijie.cave");
    expect(config.ios?.supportsTablet).toBe(false);
    expect(config.android).toBeUndefined();
  });

  it("is linked to one EAS project", () => {
    const projectId = configFor("development").extra?.eas?.projectId;

    expect(projectId).toEqual(
      expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
      )
    );
    expect(projectId).toBe("1ddc0761-af43-491c-b969-ec2f6c415013");
  });
});
