import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { ThemeProvider } from "../../../core/design/theme-provider";
import { InMemoryAppearancePreferencesRepository } from "../../../core/design/appearance-preferences";
import { JournalService } from "../application/journal-service";
import { InMemoryJournalRepository } from "../infrastructure/in-memory-journal-repository";
import { JournalListScreen } from "./JournalListScreen";
import { darkTheme } from "../../../core/design/theme";
import { formatJournalDate } from "../domain/journal-date";

test("lists private metadata and searches titles without showing bodies", async () => {
  const service = new JournalService(new InMemoryJournalRepository(), { now: () => "2026-08-28T10:00:00Z", createId: (() => { let id = 0; return () => `${++id}`; })() }, "account-a");
  await service.createRecord({ title: "说出暂停", occurredAt: "2026-08-20T00:00:00Z", highlight: { kind: "feeling", text: "安心" }, body: "不应出现在列表的私密正文" });
  await service.createRecord({ title: "一次健康沟通", occurredAt: "2026-08-21T00:00:00Z", highlight: { kind: "impression", text: "被认真倾听" } });
  render(<ThemeProvider repository={{ load: async () => "dark", save: async () => undefined }}><JournalListScreen onCreate={jest.fn()} onOpen={jest.fn()} onReview={jest.fn()} service={service} /></ThemeProvider>);
  await waitFor(() => expect(screen.getByText("一次健康沟通")).toBeTruthy());
  expect(screen.queryByText("不应出现在列表的私密正文")).toBeNull();
  fireEvent.changeText(screen.getByLabelText("搜索事件标题"), "暂停");
  expect(screen.getByText("说出暂停")).toBeTruthy();
  expect(screen.queryByText("一次健康沟通")).toBeNull();
  expect(screen.getByTestId("journal-list-screen")).toHaveStyle({ backgroundColor: darkTheme.color.background });
  expect(screen.getByTestId("journal-record-1")).toHaveStyle({ backgroundColor: darkTheme.color.surface });
  expect(screen.getByText(formatJournalDate("2026-08-20"))).toBeTruthy();
  expect(screen.queryByText(/T00:00/u)).toBeNull();
});

test("reloads records when the journal list regains focus", async () => {
  const repository = new InMemoryJournalRepository();
  const service = new JournalService(repository, {
    now: () => "2026-08-28T10:00:00Z",
    createId: () => "new-record",
  }, "account-a");
  const view = render(
    <ThemeProvider repository={new InMemoryAppearancePreferencesRepository()}>
      <JournalListScreen
        focusRevision={0}
        onCreate={jest.fn()}
        onOpen={jest.fn()}
        onReview={jest.fn()}
        service={service}
      />
    </ThemeProvider>,
  );

  await screen.findByText("还没有符合条件的记录");
  await service.createRecord({
    title: "刚刚保存的事件",
    occurredAt: "2026-08-28T09:00:00Z",
    highlight: { kind: "feeling", text: "松了一口气" },
  });

  view.rerender(
    <ThemeProvider repository={new InMemoryAppearancePreferencesRepository()}>
      <JournalListScreen
        focusRevision={1}
        onCreate={jest.fn()}
        onOpen={jest.fn()}
        onReview={jest.fn()}
        service={service}
      />
    </ThemeProvider>,
  );

  expect(await screen.findByText("刚刚保存的事件")).toBeTruthy();
});
