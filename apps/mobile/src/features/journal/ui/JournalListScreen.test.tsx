import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { ThemeProvider } from "../../../core/design/theme-provider";
import { InMemoryAppearancePreferencesRepository } from "../../../core/design/appearance-preferences";
import { JournalService } from "../application/journal-service";
import { InMemoryJournalRepository } from "../infrastructure/in-memory-journal-repository";
import { JournalListScreen } from "./JournalListScreen";
import { darkTheme } from "../../../core/design/theme";
import { formatJournalDate } from "../domain/journal-date";
import { lightTheme } from "../../../core/design/theme";

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

test("opens complete record and source rows and keeps draft resume secondary", async () => {
  const service = new JournalService(new InMemoryJournalRepository(), {
    now: () => "2026-09-24T10:00:00Z", createId: (() => { let id = 0; return () => `${++id}`; })(),
  }, "account-a");
  const record = await service.createRecord({ title: "留给自己", occurredAt: "2026-09-23", body: "休息", topics: ["self-boundaries"] });
  await service.saveDraft("new:freeform", { title: "", occurredAt: "2026-09-24", highlight: { kind: "feeling", text: "" }, body: "未完成的一句", topics: [] });
  await service.savePeriodReview({ title: "九月回顾", periodStart: "2026-09-01T00:00:00Z", periodEnd: "2026-09-24T00:00:00Z", body: "留出休息时间", sourceRecordIds: [record.id] });
  const onOpen = jest.fn(); const onCreate = jest.fn(); const onReview = jest.fn();
  render(<JournalListScreen service={service} onCreate={onCreate} onOpen={onOpen} onReview={onReview} />);
  const row = await screen.findByTestId(`journal-record-${record.id}`);
  expect(row).toHaveProp("accessibilityRole", "button");
  expect(within(row).getAllByRole("button")).toEqual([row]);
  fireEvent.press(row);
  fireEvent.press(screen.getByRole("button", { name: "回到原记录，写一个后来：留给自己" }));
  expect(onOpen).toHaveBeenNthCalledWith(1, record.id);
  expect(onOpen).toHaveBeenNthCalledWith(2, record.id);
  fireEvent.press(screen.getByRole("button", { name: "继续上次的草稿，本机草稿" }));
  expect(onCreate).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "继续上次的草稿，本机草稿" })).not.toHaveStyle({ backgroundColor: lightTheme.color.primary });
  fireEvent.press(screen.getByRole("button", { name: "回顾一段时间" }));
  expect(onReview).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/记下一句话和后来发生的变化/u)).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "内界手记，帮助" }));
  expect(screen.getByText(/主动使用 AI 并确认后/u)).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "关闭内界手记 · 帮助" }));
  expect(screen.queryByText(/主动使用 AI 并确认后/u)).toBeNull();
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

test("keeps topic filters at a fixed height and filters saved custom topics", async () => {
  const service = new JournalService(new InMemoryJournalRepository(), {
    now: () => "2026-09-24T10:00:00Z",
    createId: (() => { let id = 0; return () => `${++id}`; })(),
  }, "account-a");
  await service.createRecord({ title: "朋友的支持", occurredAt: "2026-09-24", body: "一起散步", topics: ["custom:友情"] });
  await service.createRecord({ title: "留给自己", occurredAt: "2026-09-23", body: "休息", topics: ["self-boundaries"] });
  render(<ThemeProvider repository={new InMemoryAppearancePreferencesRepository()}>
    <JournalListScreen onCreate={jest.fn()} onOpen={jest.fn()} onReview={jest.fn()} service={service} />
  </ThemeProvider>);
  await screen.findByText("朋友的支持");
  expect(screen.getByTestId("journal-topic-filters")).toHaveStyle({ flexGrow: 0, height: lightTheme.size.secondaryActionHeight, width: "100%" });
  expect(screen.getByTestId("journal-topic-filters")).toHaveProp("nestedScrollEnabled", true);
  const filters = within(screen.getByTestId("journal-topic-filters"));
  expect(filters.getByRole("button", { name: "全部" })).toHaveStyle({ flexShrink: 0, width: "auto" });
  expect(filters.getByRole("button", { name: "友情" })).toHaveStyle({ flexShrink: 0, width: "auto" });
  expect(filters.getByRole("button", { name: "友情" })).not.toHaveStyle({ backgroundColor: lightTheme.color.primary });
  const buttons = filters.getAllByRole("button").map((button) => button.props.accessibilityLabel);
  expect(buttons.indexOf("友情")).toBeLessThan(buttons.indexOf("全部"));
  expect(buttons.indexOf("友情")).toBeLessThan(buttons.indexOf("亲密关系"));
  fireEvent.press(filters.getByRole("button", { name: "友情" }));
  expect(screen.getByText("朋友的支持")).toBeTruthy();
  expect(screen.queryByText("留给自己")).toBeNull();
  fireEvent.press(filters.getByRole("button", { name: "全部" }));
  expect(screen.getByText("留给自己")).toBeTruthy();
});
