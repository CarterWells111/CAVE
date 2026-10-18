import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { ThemeProvider } from "../../../core/design/theme-provider";
import { JournalService } from "../application/journal-service";
import { JOURNAL_REVIEW_QUESTIONS } from "../domain/journal-review-prompts";
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

  expect(screen.getByRole("checkbox", { name: /今天/u })).toBeTruthy();
  expect(screen.queryByRole("checkbox", { name: /未来/u })).toBeNull();
});

 test("lets an empty week switch to a month containing older records", async () => {
  const service = new JournalService(new InMemoryJournalRepository(), { now: () => "2026-09-07T10:00:00Z", createId: () => "r" }, "a");
  await service.createRecord({ occurredAt: "2026-08-20", body: "更早的一句话" });
  render(<JournalPeriodReviewScreen service={service} onSaved={jest.fn()} now={() => new Date(2026, 8, 7, 12)} />);
  await act(async () => undefined);
  fireEvent.press(screen.getByRole("button", { name: "回顾范围，最近一个月" }));
  fireEvent.press(screen.getByRole("radio", { name: "最近一周" }));
  expect(screen.getByText("这段时间还没有记录")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "回顾范围，最近一周" }));
  fireEvent.press(screen.getByRole("radio", { name: "最近一个月" }));
  expect(screen.getByRole("checkbox", { name: /更早的一句话/u })).toBeTruthy();
 });

test("quotes only checked records, opens their original rows and preserves save guards", async () => {
  const savePeriodReview = jest.fn(() => new Promise(() => undefined));
  const onOpen = jest.fn(); const onBack = jest.fn();
  const record = { id: "r", title: "一次倾听", occurredAt: "2026-09-07", highlight: { kind: "feeling", text: "安心" }, body: "原始正文" };
  const onStartAiReview = jest.fn();
  render(<JournalPeriodReviewScreen onBack={onBack} onOpen={onOpen} onSaved={jest.fn()} now={() => new Date(2026, 8, 7, 12)} onStartAiReview={onStartAiReview}
    service={{ listRecords: async () => [record], loadRecord: async () => ({ record, entries: [] }), savePeriodReview } as never} />);
  const choice = await screen.findByRole("checkbox", { name: "一次倾听 · 安心" });
  expect(choice).toHaveProp("accessibilityState", { checked: false });
  expect(screen.getByText("只勾选你愿意引用的记录。")).toBeTruthy();
  expect(onStartAiReview).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "AI陪我回顾" }));
  expect(onStartAiReview).toHaveBeenLastCalledWith({ startDate: "2026-08-09", endDate: "2026-09-07", title: "最近 30 天的回顾", body: "", sourceRecordIds: [] });
  fireEvent.press(choice);
  await act(async () => undefined);
  expect(choice).toHaveProp("accessibilityState", { checked: true });
  fireEvent.changeText(screen.getByLabelText("由我确认的阶段小结"), "我想先保留的小结");
  fireEvent.press(screen.getByRole("button", { name: "AI陪我回顾" }));
  expect(onStartAiReview).toHaveBeenLastCalledWith(expect.objectContaining({ sourceRecordIds: ["r"], body: "我想先保留的小结" }));
  fireEvent.press(screen.getByRole("button", { name: "查看原记录：一次倾听" }));
  expect(onOpen).toHaveBeenCalledWith("r");
  fireEvent.press(choice);
  expect(screen.queryByRole("button", { name: "查看原记录：一次倾听" })).toBeNull();
  expect(screen.getByRole("button", { name: "保存我的阶段回顾" })).toBeDisabled();
  fireEvent.press(choice);
  await act(async () => undefined);
  fireEvent.changeText(screen.getByLabelText("由我确认的阶段小结"), "想继续认真倾听");
  fireEvent.press(screen.getByRole("button", { name: "保存我的阶段回顾" }));
  expect(savePeriodReview).toHaveBeenCalledWith(expect.objectContaining({ sourceRecordIds: ["r"], body: "想继续认真倾听", periodStart: "2026-08-09T00:00:00.000Z", periodEnd: "2026-09-07T00:00:00.000Z" }));
  expect(screen.getByRole("button", { name: "返回手记列表" })).toBeDisabled();
  fireEvent.press(screen.getByRole("button", { name: "返回手记列表" }));
  fireEvent.press(screen.getByRole("button", { name: "保存我的阶段回顾" }));
  expect(onBack).not.toHaveBeenCalled();
  expect(savePeriodReview).toHaveBeenCalledTimes(1);
});

test("custom period selection keeps date controls and quotation consent inline", async () => {
  render(<JournalPeriodReviewScreen service={{ listRecords: async () => [] } as never} onSaved={jest.fn()} now={() => new Date(2026, 8, 7, 12)} />);
  await act(async () => undefined);
  fireEvent.press(screen.getByRole("button", { name: "回顾范围，最近一个月" }));
  fireEvent.press(screen.getByRole("radio", { name: "自选日期" }));
  expect(screen.getByRole("button", { name: /开始日期/u })).toBeTruthy();
  expect(screen.getByRole("button", { name: /结束日期/u })).toBeTruthy();
  expect(screen.getByText("只勾选你愿意引用的记录。")).toBeTruthy();
  expect(screen.queryByText(/系统提供问题/u)).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "回顾一段时间，帮助" }));
  expect(screen.getByText(/系统提供问题/u)).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "关闭回顾一段时间 · 帮助" }));
  expect(screen.getByRole("button", { name: "回顾范围，自选日期" })).toBeTruthy();
});

test("shows one review question by default and cycles without losing the summary", async () => {
  render(<JournalPeriodReviewScreen service={{ listRecords: async () => [] } as never} onSaved={jest.fn()} now={() => new Date(2026, 8, 7, 12)} />);
  await act(async () => undefined);
  expect(screen.getByText(JOURNAL_REVIEW_QUESTIONS[0])).toBeTruthy();
  for (const prompt of JOURNAL_REVIEW_QUESTIONS.slice(1)) {
    expect(screen.queryByText(prompt)).toBeNull();
  }
  expect(screen.queryByRole("button", { name: "试试引导写作（可跳过）" })).toBeNull();
  expect(screen.queryByRole("button", { name: "自由写" })).toBeNull();
  fireEvent.changeText(screen.getByLabelText("由我确认的阶段小结"), "我想保留自己的经验，慢慢整理。");
  for (const prompt of [...JOURNAL_REVIEW_QUESTIONS, ...JOURNAL_REVIEW_QUESTIONS]) {
    expect(screen.getByText(prompt)).toBeTruthy();
    for (const other of JOURNAL_REVIEW_QUESTIONS.filter((item) => item !== prompt)) {
      expect(screen.queryByText(other)).toBeNull();
    }
    expect(screen.getByLabelText("由我确认的阶段小结")).toHaveProp("value", "我想保留自己的经验，慢慢整理。");
    expect(screen.queryByRole("button", { name: "结束引导" })).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "换一个引导" }));
  }
  expect(screen.getByText(JOURNAL_REVIEW_QUESTIONS[0])).toBeTruthy();
  expect(screen.getByLabelText("由我确认的阶段小结")).toHaveProp("value", "我想保留自己的经验，慢慢整理。");
});
