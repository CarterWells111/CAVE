import { useRouter } from "expo-router";
import { Screen } from "../../src/core/ui/Screen";
import { Button } from "../../src/core/ui/Button";
import { SecondaryButton } from "../../src/core/ui/secondary-button";
import { useAdultDeclaration } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { useJournalAccess } from "../../src/features/journal/runtime/JournalAccessProvider";
import { JournalRouteGate } from "../../src/features/journal/ui/JournalRouteGate";
import { ShellFrame, SupportingText } from "../../src/features/shell/ui/shell-ui-components";


export default function JournalHomeRoute() {
  const router = useRouter();
  const adult = useAdultDeclaration();
  const access = useJournalAccess();
  if (adult.status === "authorized" && access.status !== "locked") {
    return <JournalRouteGate><JournalTabContent /></JournalRouteGate>;
  }
  const start = () => adult.status === "authorized"
    ? router.push({ pathname: "/auth/email", params: { returnTo: "/(tabs)/journal" } })
    : router.push({ pathname: "/journey/adult-gate", params: { entry: "journal" } });
  return <Screen contentSafeAreaTop><ShellFrame title="内界手记">
    <SupportingText>留一点时间，写下今天的自己。</SupportingText>
    <SupportingText>感受、发现，或还没想清楚的事，都可以慢慢记下来。以后再回来看见自己的变化。</SupportingText>
    <Button label="开始写手记" onPress={start} />
    <SupportingText>仅供年满 18 岁的成年人使用。登录后，手记与当前账号关联；正文保存在本机，不会自动上传。</SupportingText>
    <SecondaryButton label="设置" onPress={() => router.push("/settings")} />
  </ShellFrame></Screen>;
}

import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";

import { useReadyJournalService } from "../../src/features/journal/runtime/JournalAccessProvider";
import { JournalListScreen } from "../../src/features/journal/ui/JournalListScreen";




export function JournalTabContent() {
  const router = useRouter();
  const journalService = useReadyJournalService();
  const [focusRevision, setFocusRevision] = useState(0);
  const firstFocus = useRef(true);

  useFocusEffect(useCallback(() => {
    if (firstFocus.current) {
      firstFocus.current = false;
      return;
    }
    setFocusRevision((revision) => revision + 1);
  }, []));

  return (
    <JournalListScreen
      focusRevision={focusRevision}
      service={journalService}
      onCreate={() => router.push("/journal/new")}
      onOpen={(id) => router.push({ pathname: "/journal/[id]", params: { id } })}
      onReview={() => router.push("/journal/review")}
    />
  );
}
