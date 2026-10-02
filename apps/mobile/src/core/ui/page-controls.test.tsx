import { fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";
import { TextInput } from "react-native";

import { ActionRow } from "./action-row";
import { HelpText, PageHeader } from "./page-header";
import { SelectionField } from "./selection-field";

test("page help is opt-in, closes via Android back, and preserves input", () => {
  function Page() {
    const [draft, setDraft] = useState("");
    return <><PageHeader title="手记" help={<HelpText>说明全文</HelpText>} />
      <TextInput accessibilityLabel="正文" value={draft} onChangeText={setDraft} /></>;
  }
  render(<Page />);
  expect(screen.queryByText("说明全文")).toBeNull();
  fireEvent.changeText(screen.getByLabelText("正文"), "保留的草稿");
  fireEvent.press(screen.getByRole("button", { name: "手记，帮助" }));
  expect(screen.getByText("说明全文")).toBeTruthy();
  expect(screen.getByTestId("bottom-sheet-scroll")).toBeTruthy();
  fireEvent(screen.getByTestId("bottom-sheet-modal"), "requestClose");
  expect(screen.queryByText("说明全文")).toBeNull();
  expect(screen.getByLabelText("正文")).toHaveProp("value", "保留的草稿");
});

test("selection changes only on choosing an option, cancel preserves value", () => {
  const changed = jest.fn();
  render(<SelectionField label="记录类型" value="action" options={[{ value: "action", label: "行动" }, { value: "feeling", label: "感受" }]} onChange={changed} />);
  const trigger = screen.getByRole("button", { name: "记录类型，行动" });
  fireEvent.press(trigger);
  expect(screen.getByRole("radio", { name: "行动" })).toHaveProp("accessibilityState", { checked: true, disabled: false });
  fireEvent.press(screen.getByRole("button", { name: "关闭记录类型" }));
  expect(changed).not.toHaveBeenCalled();
  fireEvent.press(trigger);
  fireEvent.press(screen.getByRole("radio", { name: "感受" }));
  expect(changed).toHaveBeenCalledWith("feeling");
  expect(screen.queryByRole("radio")).toBeNull();
});

test("navigation row is one named target and disables navigation when unavailable", () => {
  const navigate = jest.fn();
  const { rerender } = render(<ActionRow title="记录标题" subtitle="昨天" onPress={navigate} />);
  fireEvent.press(screen.getByRole("button", { name: "记录标题，昨天" }));
  expect(navigate).toHaveBeenCalledTimes(1);
  rerender(<ActionRow title="记录标题" subtitle="昨天" disabled onPress={navigate} />);
  fireEvent.press(screen.getByRole("button", { name: "记录标题，昨天" }));
  expect(navigate).toHaveBeenCalledTimes(1);
});

test("page header blocks returning during a pending operation", () => {
  const back = jest.fn();
  const { rerender } = render(<PageHeader title="保存中" onBack={back} backDisabled />);
  fireEvent.press(screen.getByRole("button", { name: "返回" }));
  expect(back).not.toHaveBeenCalled();
  rerender(<PageHeader title="已保存" onBack={back} />);
  fireEvent.press(screen.getByRole("button", { name: "返回" }));
  expect(back).toHaveBeenCalledTimes(1);
});
