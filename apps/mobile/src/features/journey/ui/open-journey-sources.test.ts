import { Alert, Linking } from "react-native";

import { openJourneySources } from "./open-journey-sources";

const sources = [
  {
    accessedAt: "2026-08-27",
    appliesTo: "test",
    id: "SRC-001",
    organization: "来源一",
    publicationOrReviewDate: "2026-08-27",
    sourceType: "EDU" as const,
    title: "来源一标题",
    url: "https://example.com/one",
    verificationStatus: "source_verified" as const,
  },
  {
    accessedAt: "2026-08-27",
    appliesTo: "test",
    id: "SRC-002",
    organization: "来源二",
    publicationOrReviewDate: "2026-08-27",
    sourceType: "SAFE" as const,
    title: "来源二标题",
    url: "https://example.com/two",
    verificationStatus: "source_verified" as const,
  },
];

afterEach(() => jest.restoreAllMocks());

test("deduplicates requested sources and opens the selected link", async () => {
  const openUrl = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  const alert = jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
    buttons?.[0]?.onPress?.();
  });

  await openJourneySources(sources, ["SRC-001", "SRC-001", "SRC-002"]);

  expect(alert).toHaveBeenCalledTimes(1);
  expect(alert.mock.calls[0]?.[2]).toHaveLength(3);
  expect(openUrl).toHaveBeenCalledWith("https://example.com/one");
});

test("resolves without showing a picker when no source matches", async () => {
  const alert = jest.spyOn(Alert, "alert");

  await expect(openJourneySources(sources, ["SRC-999"])).resolves.toBeUndefined();
  expect(alert).not.toHaveBeenCalled();
});

test("resolves when the picker is cancelled or opening a link fails", async () => {
  jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("offline"));
  jest.spyOn(Alert, "alert")
    .mockImplementationOnce((_title, _message, buttons) => buttons?.at(-1)?.onPress?.())
    .mockImplementationOnce((_title, _message, buttons) => buttons?.[0]?.onPress?.());

  await expect(openJourneySources(sources, ["SRC-001"])).resolves.toBeUndefined();
  await expect(openJourneySources(sources, ["SRC-001"])).resolves.toBeUndefined();
});
