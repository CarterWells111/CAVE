import type { SavedCommunicationCardMetadata } from "../../journey/domain/types";
import type { ReviewVersionMetadata } from "../../reviews/infrastructure/review-history-repository";
import { toCardArchiveItems, toReviewArchiveItems } from "./profile-archive";

test("maps card metadata into a newest-first private archive", () => {
  const records: SavedCommunicationCardMetadata[] = [
    { id: "older-card", journeyId: "journey-1", savedAt: "2026-08-20T10:00:00.000Z" },
    { id: "newer-card", journeyId: "journey-2", savedAt: "2026-08-27T10:00:00.000Z" },
  ];

  expect(toCardArchiveItems(records)).toEqual([
    { id: "newer-card", title: "沟通卡", dateLabel: "2026-08-27", statusLabel: "仅存本机" },
    { id: "older-card", title: "沟通卡", dateLabel: "2026-08-20", statusLabel: "仅存本机" },
  ]);
});

test("maps review metadata into a newest-first archive without loading payloads", () => {
  const records: ReviewVersionMetadata[] = [
    {
      id: "older-review",
      rootId: "root-1",
      parentVersionId: null,
      title: "较早回顾",
      createdAt: "2026-08-21T10:00:00.000Z",
      status: "incomplete",
    },
    {
      id: "newer-review",
      rootId: "root-2",
      parentVersionId: null,
      title: "最近回顾",
      createdAt: "2026-08-28T10:00:00.000Z",
      status: "completed",
    },
  ];

  expect(toReviewArchiveItems(records)).toEqual([
    { id: "newer-review", title: "最近回顾", dateLabel: "2026-08-28", statusLabel: "已完成" },
    { id: "older-review", title: "较早回顾", dateLabel: "2026-08-21", statusLabel: "未完成" },
  ]);
});
