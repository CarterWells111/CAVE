import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWindowDimensions } from "react-native";

import { Screen } from "../../src/core/ui/Screen";
import { useAccountProfile } from "../../src/features/account/runtime/AccountProfileProvider";
import { getResumePath } from "../../src/features/journey/application/journey-navigation";
import {
  type JourneyRuntimeContextValue,
  useOptionalJourneyRuntime,
} from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { WelcomePage } from "../../src/features/journey/ui/pages/WelcomePage";
import { resolveFirstRunLayout } from "../../src/features/journey/ui/first-run-layout";
import { useJournalAccess } from "../../src/features/journal/runtime/JournalAccessProvider";
import { classifyActiveJourney } from "../../src/features/shell/application/app-shell-service";
import type { AppShellState } from "../../src/features/shell/domain/app-shell-state";
import { HomeScreen } from "../../src/features/shell/ui/HomeScreen";
import type { ShellMetadataItem } from "../../src/features/shell/ui/shell-ui-components";

type HomeLoadState = "loading" | "ready" | "error";

export default function HomeRoute() {
  const runtime = useOptionalJourneyRuntime();
  return runtime === null
    ? <FirstRunHomeRoute runtime={null} />
    : <AuthorizedHomeRoute runtime={runtime} />;
}

function FirstRunHomeRoute({ runtime }: { runtime: JourneyRuntimeContextValue | null }) {
  const router = useRouter();
  const { fontScale, height, width } = useWindowDimensions();
  const [viewport, setViewport] = useState<{ height: number; width: number } | null>(null);
  const layout = resolveFirstRunLayout({
    fontScale,
    height: viewport?.height ?? height,
    width: viewport?.width ?? width,
  });
  const snapshot = runtime?.snapshot ?? null;
  const resumeAvailable = snapshot?.ageConfirmed === true;
  const resume = () => {
    if (snapshot === null || snapshot.addressPreference === null || !snapshot.prefaceRead) {
      router.push("/journey/preface");
      return;
    }
    router.push(getResumePath(snapshot));
  };

  return (
    <Screen
      alwaysBounceVertical={false}
      contentContainerStyle={{ paddingVertical: layout.screenPaddingVertical }}
      onLayout={({ nativeEvent }) => setViewport({
        height: nativeEvent.layout.height,
        width: nativeEvent.layout.width,
      })}
      scrollEnabled={false}
      testID="first-run-home-scroll"
    >
      <WelcomePage
        brandPaddingTop={layout.brandPaddingTop}
        layout={layout.brandLayout}
        onOpenSettings={() => router.push("/settings")}
        onResume={resume}
        onStart={() => router.push("/journey/adult-gate")}
        resumeAvailable={resumeAvailable}
      />
    </Screen>
  );
}

function AuthorizedHomeRoute({ runtime }: { runtime: JourneyRuntimeContextValue }) {
  const router = useRouter();
  const accountProfile = useAccountProfile();
  const journalAccess = useJournalAccess();
  const [loadState, setLoadState] = useState<HomeLoadState>("loading");
  const [cards, setCards] = useState<ShellMetadataItem[]>([]);
  const [completion, setCompletion] = useState<AppShellState | null>(null);
  const [journalRecords, setJournalRecords] = useState<ShellMetadataItem[]>([]);
  const loadGeneration = useRef(0);

  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    setLoadState("loading");
    if (journalAccess.status !== "ready") setJournalRecords([]);
    try {
      const [nextCompletion, journal] = await Promise.all([
        runtime.shellState.load(),
        journalAccess.status === "ready" && journalAccess.service !== undefined
          ? journalAccess.service.listRecords()
          : Promise.resolve([]),
      ]);
      if (generation !== loadGeneration.current) return;
      setJournalRecords(journal.slice(0, 3).map((record) => ({
        id: record.id,
        title: record.title,
        dateLabel: record.occurredAt.slice(0, 10),
        statusLabel: record.highlight.text,
      })));
      if (nextCompletion === null) {
        setCards([]);
        setCompletion(null);
        setLoadState("ready");
        return;
      }
      const records = await runtime.cards.listMetadata();
      if (generation !== loadGeneration.current) return;
      setCards(records.map((record) => ({
        id: record.id,
        title: "沟通草稿",
        dateLabel: record.savedAt.slice(0, 10),
        statusLabel: "已保存到本机",
      })));
      setCompletion(nextCompletion);
      setLoadState("ready");
    } catch {
      if (generation === loadGeneration.current) setLoadState("error");
    }
  }, [journalAccess.service, journalAccess.status, runtime.cards, runtime.shellState]);

  useEffect(() => {
    void load();
    return () => { loadGeneration.current += 1; };
  }, [load]);

  if (loadState === "ready" && completion === null) {
    return <FirstRunHomeRoute runtime={runtime} />;
  }

  const activeKind = classifyActiveJourney(runtime.snapshot, completion);
  const activeJourney = activeKind !== null && runtime.snapshot
    ? {
        id: runtime.snapshot.id,
        kind: activeKind,
        title: activeKind === "initial" ? "首次旅程" : "本次回顾",
        dateLabel: runtime.snapshot.updatedAt.slice(0, 10),
        statusLabel: "进行中",
      }
    : null;

  return (
    <Screen>
      <HomeScreen
        account={{
          status: accountProfile.status,
          ...(accountProfile.profile?.displayName === undefined
            ? {}
            : { displayName: accountProfile.profile.displayName }),
          onOpen: () => router.push(
            accountProfile.status === "signedOut" ? "/auth/email" : "/(tabs)/profile",
          ),
        }}
        activeJourney={activeJourney}
        currentCard={cards[0] ?? null}
        loadState={loadState}
        onContinueJourney={() => router.push(getResumePath(runtime.snapshot))}
        onOpenCurrentCard={(id) => router.push(`/cards/${id}`)}
        onOpenJournal={() => router.push("/journal/new")}
        onOpenRecord={(id) => router.push({ pathname: "/journal/[id]", params: { id } })}
        onRetry={() => { void load(); }}
        onStartPractice={() => router.push("/practice/session")}
        onStartReview={() => {
          if (activeKind === "initial") {
            router.push(getResumePath(runtime.snapshot));
            return;
          }
          void runtime.replaceActiveReview().then(() => router.push("/journey/welcome"));
        }}
        recentRecords={journalRecords}
      />
    </Screen>
  );
}
