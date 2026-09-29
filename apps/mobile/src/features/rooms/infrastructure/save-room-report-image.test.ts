import { captureRef } from "react-native-view-shot";
import * as MediaLibrary from "expo-media-library";
import type { View } from "react-native";
import { saveRoomReportImage } from "./save-room-report-image";

jest.mock("react-native-view-shot", () => ({ captureRef: jest.fn() }));
jest.mock("expo-media-library", () => ({ requestPermissionsAsync: jest.fn(), saveToLibraryAsync: jest.fn() }));

const permission = MediaLibrary.requestPermissionsAsync as jest.Mock;
const save = MediaLibrary.saveToLibraryAsync as jest.Mock;
const capture = captureRef as jest.Mock;
beforeEach(() => jest.clearAllMocks());

test("image export happens only after add-only permission and captures the report view", async () => {
  permission.mockResolvedValue({ granted: true });
  capture.mockResolvedValue("file:///report.png");
  const view = {} as View;
  expect(await saveRoomReportImage(view)).toBe("saved");
  expect(permission).toHaveBeenCalledWith(true, ["photo"]);
  expect(capture).toHaveBeenCalledWith(view, { format: "png", quality: 1, result: "tmpfile" });
  expect(save).toHaveBeenCalledWith("file:///report.png");
});

test("denied photo permission does not capture or save", async () => {
  permission.mockResolvedValue({ granted: false });
  expect(await saveRoomReportImage({} as View)).toBe("permission-denied");
  expect(capture).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
});
