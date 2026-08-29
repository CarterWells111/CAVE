import { fireEvent, render, screen } from "@testing-library/react-native";

import { InMemoryAppearancePreferencesRepository } from "../../../core/design/appearance-preferences";
import { ThemeProvider } from "../../../core/design/theme-provider";
import { JournalService } from "../application/journal-service";
import { InMemoryJournalRepository } from "../infrastructure/in-memory-journal-repository";
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
