import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { CommunicationCardPage } from "./JourneyPages";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

test("keeps the latest edit visible and flushes it before save or copy", async () => {
  const edit = deferred();
  const onEdit = jest.fn(() => edit.promise);
  const onSave = jest.fn(async () => undefined);
  const onCopy = jest.fn(async () => undefined);
  const fields = [{ id: "intentions", text: "旧文字", needsReview: false }];
  const view = render(
    <CommunicationCardPage
      fields={fields}
      onCopy={onCopy}
      onEdit={onEdit}
      onSave={onSave}
      pointTotal={0}
    />
  );

  fireEvent.changeText(screen.getByDisplayValue("旧文字"), "最新文字");
  view.rerender(
    <CommunicationCardPage
      fields={fields}
      onCopy={onCopy}
      onEdit={onEdit}
      onSave={onSave}
      pointTotal={0}
    />
  );
  expect(screen.getByDisplayValue("最新文字")).toBeTruthy();

  fireEvent.press(screen.getByText("本机保存"));
  fireEvent.press(screen.getByText("复制当前卡片"));
  expect(onSave).not.toHaveBeenCalled();
  expect(onCopy).not.toHaveBeenCalled();

  await act(async () => { edit.resolve(); });
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(onCopy).toHaveBeenCalledTimes(1));
  expect(onEdit).toHaveBeenCalledWith("intentions", "最新文字");
});
