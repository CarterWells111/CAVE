import type { SavedCommunicationCardMetadata } from "../../journey/domain/types";
import type { ReviewVersionMetadata } from "../../reviews/infrastructure/review-history-repository";
import type { ShellMetadataItem } from "./shell-ui-components";

export function toCardArchiveItems(
  records: ReadonlyArray<SavedCommunicationCardMetadata>,
): ShellMetadataItem[] {
  return [...records]
    .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
    .map((record) => ({
      id: record.id,
      title: "沟通卡",
      dateLabel: record.savedAt.slice(0, 10),
      statusLabel: "仅存本机",
    }));
}

export function toReviewArchiveItems(
  records: ReadonlyArray<ReviewVersionMetadata>,
): ShellMetadataItem[] {
  return [...records]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((record) => ({
      id: record.id,
      title: record.title,
      dateLabel: record.createdAt.slice(0, 10),
      statusLabel: record.status === "completed" ? "已完成" : "未完成",
    }));
}
