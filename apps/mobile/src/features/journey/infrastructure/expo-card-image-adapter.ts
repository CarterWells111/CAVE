import * as MediaLibrary from "expo-media-library";

export type CardImageSaveErrorCode =
  | "permission-denied"
  | "limited-access"
  | "permission-failed"
  | "write-failed";

export class CardImageSaveError extends Error {
  constructor(readonly code: CardImageSaveErrorCode) {
    super("无法将图片保存到本机相册。");
    this.name = "CardImageSaveError";
  }
}

export async function saveCardImageToLibrary(fileUri: string): Promise<void> {
  let permission: MediaLibrary.PermissionResponse;
  try {
    permission = await MediaLibrary.requestPermissionsAsync(true, ["photo"]);
  } catch {
    throw new CardImageSaveError("permission-failed");
  }

  if (permission.accessPrivileges === "limited") {
    throw new CardImageSaveError("limited-access");
  }
  if (permission.status !== "granted") {
    throw new CardImageSaveError("permission-denied");
  }

  try {
    await MediaLibrary.createAssetAsync(fileUri);
  } catch {
    throw new CardImageSaveError("write-failed");
  }
}
