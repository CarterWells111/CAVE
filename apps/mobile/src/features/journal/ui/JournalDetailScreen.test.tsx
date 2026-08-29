import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

import { InMemoryAppearancePreferencesRepository } from "../../../core/design/appearance-preferences";
import { ThemeProvider } from "../../../core/design/theme-provider";
import { JournalService } from "../application/journal-service";
import { InMemoryJournalRepository } from "../infrastructure/in-memory-journal-repository";
import { JournalDeletionCleanupRequiredError } from "../infrastructure/journal-repository";
import { JournalDetailScreen } from "./JournalDetailScreen";
import { formatJournalDate } from "../domain/journal-date";

test("offers an explicit back action after a journal record is saved", async () => {
  const repository = new InMemoryJournalRepository();
  const service = new JournalService(repository, {
    now: () => "2026-08-28T10:00:00Z",
    createId: () => "saved-record",
  }, "account-a");
  await service.createRecord({
    title: "已经保存的事件",
    occurredAt: "2026-08-28T09:00:00Z",
    highlight: { kind: "feeling", text: "安心" },
  });
  const onBack = jest.fn();

  render(
    <ThemeProvider repository={new InMemoryAppearancePreferencesRepository()}>
      <JournalDetailScreen
        id="saved-record"
        onAdd={jest.fn()}
        onBack={onBack}
        onDeleted={jest.fn()}
        service={service}
      />
    </ThemeProvider>,
  );

  fireEvent.press(await screen.findByRole("button", { name: "返回手记列表" }));
  expect(onBack).toHaveBeenCalledTimes(1);
  expect(screen.getByText(`发生于 ${formatJournalDate("2026-08-28")}`)).toBeTruthy();
  expect(screen.queryByText(/T09:00/u)).toBeNull();
});

const storedRecord = {
  id: "saved-record",
  title: "已经保存的事件",
  occurredAt: "2026-08-28",
  createdAt: "2026-08-28T10:00:00.000Z",
  updatedAt: "2026-08-28T10:00:00.000Z",
  editableUntil: "2099-08-29T10:00:00.000Z",
  highlight: { kind: "feeling" as const, text: "安心" },
  body: "原始内容",
  topics: [],
  source: { kind: "freeform" as const },
  cardSnapshot: null,
};

function confirmDestructiveAlerts() {
  return jest.spyOn(Alert, "alert").mockImplementation((
    _title,
    _message,
    buttons,
  ) => {
    buttons?.find(({ style }) => style === "destructive")?.onPress?.();
  });
}

test("shows a retry path when a record deletion committed but cleanup is pending", async () => {
  const alert = confirmDestructiveAlerts();
  const deleteRecord = jest.fn()
    .mockRejectedValueOnce(new JournalDeletionCleanupRequiredError())
    .mockResolvedValueOnce(undefined);
  const onDeleted = jest.fn();
  const service = {
    loadRecord: jest.fn(async () => ({ record: storedRecord, entries: [] })),
    deleteRecord,
  };

  render(
    <ThemeProvider repository={new InMemoryAppearancePreferencesRepository()}>
      <JournalDetailScreen
        id="saved-record"
        onAdd={jest.fn()}
        onBack={jest.fn()}
        onDeleted={onDeleted}
        service={service as never}
      />
    </ThemeProvider>,
  );

  fireEvent.press(await screen.findByRole("button", { name: "永久删除这条记录" }));
  expect(await screen.findByText("手记已删除，安全清理待完成")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "重试安全清理" }));

  await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
  expect(deleteRecord).toHaveBeenCalledTimes(2);
  alert.mockRestore();
});

test("shows a retry path when an entry deletion committed but cleanup is pending", async () => {
  const alert = confirmDestructiveAlerts();
  const entry = {
    id: "entry-a",
    recordId: storedRecord.id,
    kind: "insight" as const,
    occurredAt: "2026-08-28",
    createdAt: "2026-08-28T11:00:00.000Z",
    updatedAt: "2026-08-28T11:00:00.000Z",
    editableUntil: "2099-08-29T11:00:00.000Z",
    highlight: null,
    body: "后来内容",
  };
  const deleteEntry = jest.fn()
    .mockRejectedValueOnce(new JournalDeletionCleanupRequiredError())
    .mockResolvedValueOnce(undefined);
  const loadRecord = jest.fn()
    .mockResolvedValueOnce({ record: storedRecord, entries: [entry] })
    .mockResolvedValue({ record: storedRecord, entries: [] });
  const service = { loadRecord, deleteEntry };

  render(
    <ThemeProvider repository={new InMemoryAppearancePreferencesRepository()}>
      <JournalDetailScreen
        id="saved-record"
        onAdd={jest.fn()}
        onBack={jest.fn()}
        onDeleted={jest.fn()}
        service={service as never}
      />
    </ThemeProvider>,
  );

  fireEvent.press(await screen.findByRole("button", { name: "删除这条后来" }));
  expect(await screen.findByText("补充已删除，安全清理待完成")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "重试安全清理" }));

  await waitFor(() => expect(screen.getByText("还没有后续补充。")).toBeTruthy());
  expect(deleteEntry).toHaveBeenCalledTimes(2);
  alert.mockRestore();
});
