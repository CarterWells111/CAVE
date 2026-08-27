jest.mock("expo-media-library", () => ({
  __esModule: true,
  requestPermissionsAsync: jest.fn(),
  createAssetAsync: jest.fn()
}));

import { Linking } from "react-native";

import {
  CardImageSaveError,
  cardImagePermissionRecovery,
  saveCardImageToLibrary
} from "./expo-card-image-adapter";

const mediaLibrary = jest.requireMock<{
  requestPermissionsAsync: jest.Mock;
  createAssetAsync: jest.Mock;
}>("expo-media-library");
const mockRequestPermissionsAsync = mediaLibrary.requestPermissionsAsync;
const mockCreateAssetAsync = mediaLibrary.createAssetAsync;

beforeEach(() => {
  jest.clearAllMocks();
});

test("does not request photo permissions until the user invokes save", async () => {
  expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
  expect(mockCreateAssetAsync).not.toHaveBeenCalled();

  mockRequestPermissionsAsync.mockResolvedValue({ status: "granted", accessPrivileges: "all" });
  mockCreateAssetAsync.mockResolvedValue({ id: "asset-1" });

  await saveCardImageToLibrary("file:///local/card.png");

  expect(mockRequestPermissionsAsync).toHaveBeenCalledWith(true, ["photo"]);
  expect(mockCreateAssetAsync).toHaveBeenCalledWith("file:///local/card.png");
});

test("rejects denied permission with a safe typed error and does not write", async () => {
  mockRequestPermissionsAsync.mockResolvedValue({
    status: "denied",
    accessPrivileges: "none"
  });

  await expect(saveCardImageToLibrary("file:///private/card.png")).rejects.toMatchObject({
    name: "CardImageSaveError",
    code: "permission-denied",
    message: "无法将图片保存到本机相册。"
  });
  expect(mockCreateAssetAsync).not.toHaveBeenCalled();
});

test("offers an explicit settings recovery for permanently denied permission without opening it automatically", async () => {
  const openSettings = jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
  mockRequestPermissionsAsync.mockResolvedValue({
    status: "denied",
    canAskAgain: false,
    accessPrivileges: "none"
  });

  await expect(saveCardImageToLibrary("file:///private/card.png")).rejects.toMatchObject({
    code: "permission-denied",
    recovery: "open-settings"
  });
  expect(openSettings).not.toHaveBeenCalled();
  expect(mockCreateAssetAsync).not.toHaveBeenCalled();

  await cardImagePermissionRecovery.openSettings();

  expect(openSettings).toHaveBeenCalledTimes(1);
});

test("does not offer settings recovery while photo permission can still be requested", async () => {
  mockRequestPermissionsAsync.mockResolvedValue({
    status: "denied",
    canAskAgain: true,
    accessPrivileges: "none"
  });

  await expect(saveCardImageToLibrary("file:///private/card.png")).rejects.toMatchObject({
    code: "permission-denied",
    recovery: null
  });
});

test("rejects limited photo access instead of claiming a successful save", async () => {
  mockRequestPermissionsAsync.mockResolvedValue({
    status: "granted",
    accessPrivileges: "limited"
  });

  await expect(saveCardImageToLibrary("file:///local/card.png")).rejects.toEqual(
    new CardImageSaveError("limited-access")
  );
  expect(mockCreateAssetAsync).not.toHaveBeenCalled();
});

test("converts permission and write failures into generic errors without leaking details", async () => {
  mockRequestPermissionsAsync.mockRejectedValueOnce(new Error("private native permission details"));

  const permissionFailure = saveCardImageToLibrary("file:///private/card.png");
  await expect(permissionFailure).rejects.toMatchObject({ code: "permission-failed" });
  await expect(permissionFailure).rejects.not.toThrow(/private native permission details/u);

  mockRequestPermissionsAsync.mockResolvedValueOnce({ status: "granted", accessPrivileges: "all" });
  mockCreateAssetAsync.mockRejectedValueOnce(new Error("private filesystem details"));

  const writeFailure = saveCardImageToLibrary("file:///private/card.png");
  await expect(writeFailure).rejects.toMatchObject({ code: "write-failed" });
  await expect(writeFailure).rejects.not.toThrow(/private filesystem details/u);
});
