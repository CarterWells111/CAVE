import { useRouter } from "expo-router";

import { useAssistantHistorySession } from "../src/features/assistant/AssistantHistoryProvider";
import { AssistantHistoryPage } from "../src/features/assistant/assistant-history-page";

export default function AssistantHistoryRoute() {
  const router = useRouter();
  const history = useAssistantHistorySession();
  const returnToChat = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/ai");
  };
  return <AssistantHistoryPage
    conversations={history.conversations}
    activeId={history.activeId}
    loading={history.loading}
    busy={history.busy}
    error={history.error}
    onBack={returnToChat}
    onSelect={id => { history.selectConversation(id); returnToChat(); }}
    onNew={() => { history.newConversation(); returnToChat(); }}
    onDelete={history.removeConversation}
    onMove={history.moveConversation}
    onRetry={history.retry}
  />;
}
