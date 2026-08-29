import { Text } from "react-native";

import { useTheme } from "../../../../core/design/theme-provider";
import { BottomSheet } from "../../../../core/ui/bottom-sheet";
import type { AddressPreference } from "../../domain/types";
import { JourneyAction } from "../components/JourneyAction";

type PrefaceWelcomeSheetProps = {
  onConfirm(): void | Promise<void>;
  preference: Exclude<AddressPreference, null>;
  visible: boolean;
};

export function PrefaceWelcomeSheet({
  onConfirm,
  preference,
  visible,
}: PrefaceWelcomeSheetProps) {
  const theme = useTheme();
  const bodyStyle = { ...theme.typography.body, color: theme.color.text };

  return (
    <BottomSheet
      dismissible={false}
      onClose={() => undefined}
      title="欢迎来到内界 CAVE"
      visible={visible}
    >
      <Text selectable style={bodyStyle}>
        遇见喜欢的人，听到某句情话，或面对某种爱抚与刺激时，身体可能会自然作出反应。这些反应可能让{preference}好奇，也可能让{preference}不适，甚至觉得不可接受。
      </Text>
      <Text selectable style={bodyStyle}>
        无论是哪一种，{preference}都可以从认识身体与同意开始，慢慢形成自己对性与亲密的理解。
      </Text>
      <Text selectable style={bodyStyle}>
        我们知道，界面里的文字不一定能完整托住{preference}的经历，也不会替{preference}下结论。希望它们可以成为一个起点：{preference}可以记下此刻的感受，在情境练习里试着说出一句话，也可以在安全、独处时对着镜子练习。
      </Text>
      <Text selectable style={bodyStyle}>
        这不是为了让{preference}表现得更大胆，而是让那些过去没有被看见的需要与声音，更容易先被{preference}自己听见，再由{preference}决定是否告诉别人。
      </Text>
      <JourneyAction
        errorMessage="阅读状态暂时无法保存，请重试。"
        label="我已了解，开始旅程"
        loadingLabel="正在进入旅程…"
        onAction={onConfirm}
      />
    </BottomSheet>
  );
}
