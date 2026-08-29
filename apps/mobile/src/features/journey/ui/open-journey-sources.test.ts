import { Alert, Linking } from "react-native";

import { JOURNEY_SOURCES_URL, openJourneySources } from "./open-journey-sources";

afterEach(() => jest.restoreAllMocks());

test("opens the single official sources entry without showing a source picker", async () => {
  const openUrl = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);

  await openJourneySources();

  expect(JOURNEY_SOURCES_URL).toBe("https://neijiecave.com/sources/");
  expect(alert).not.toHaveBeenCalled();
  expect(openUrl).toHaveBeenCalledTimes(1);
  expect(openUrl).toHaveBeenCalledWith(JOURNEY_SOURCES_URL);
});

test("shows an accessible retry when opening the official sources entry fails", async () => {
  const openUrl = jest.spyOn(Linking, "openURL")
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(true);
  openUrl.mockClear();
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);

  await expect(openJourneySources()).resolves.toBeUndefined();
  expect(alert).toHaveBeenCalledWith(
    "无法打开信息来源",
    "请检查网络连接后重试。",
    expect.arrayContaining([expect.objectContaining({ text: "重试" })]),
  );

  const retry = alert.mock.calls[0]?.[2]?.find(({ text }) => text === "重试");
  retry?.onPress?.();
  await Promise.resolve();
  expect(openUrl).toHaveBeenCalledTimes(2);
});
