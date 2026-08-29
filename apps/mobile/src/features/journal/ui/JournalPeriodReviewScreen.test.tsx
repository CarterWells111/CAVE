import { act, render, screen } from "@testing-library/react-native";

import { ThemeProvider } from "../../../core/design/theme-provider";
import { JournalService } from "../application/journal-service";
import { InMemoryJournalRepository } from "../infrastructure/in-memory-journal-repository";
import { JournalPeriodReviewScreen } from "./JournalPeriodReviewScreen";

test("does not offer future-dated records in the recent 30 day review", async () => {
  const service = new JournalService(new InMemoryJournalRepository(), {
    now: () => "2026-08-29T11:00:00.000Z",
    createId: (() => { let id = 0; return () => `record-${++id}`; })(),
  }, "account-a");
  await service.createRecord({ title: "今天", occurredAt: "2026-08-29", highlight: { kind: "feeling", text: "平静" } });
  await service.createRecord({ title: "未来", occurredAt: "2026-08-30", highlight: { kind: "feeling", text: "期待" } });
  const now = () => new Date(2026, 7, 29, 12);

  render(
    <ThemeProvider repository={{ load: async () => "dark", save: async () => undefined }}>
      <JournalPeriodReviewScreen
        now={now}
        onSaved={jest.fn()}
        service={service}
      />
    </ThemeProvider>,
  );
  await act(async () => undefined);

  expect(screen.getByRole("button", { name: /今天/u })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /未来/u })).toBeNull();
});
