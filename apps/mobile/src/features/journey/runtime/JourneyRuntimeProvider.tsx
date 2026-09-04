import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { Text, View } from "react-native";

import { InMemoryAppearancePreferencesRepository } from "../../../core/design/appearance-preferences";
import { ThemeProvider } from "../../../core/design/theme-provider";
import { DatabaseRecoveryRequiredError } from "../../../core/storage/database";
import { Button } from "../../../core/ui/Button";
import { ErrorState } from "../../../core/ui/ErrorState";
import { SecondaryButton } from "../../../core/ui/secondary-button";
import { useOptionalAccountPreferences } from "../../account/runtime/AccountPreferencesProvider";
import { useOptionalAuth } from "../../auth/runtime/AuthProvider";
import { AccountJournalDeletionContext } from "../../account/runtime/account-journal-deletion-context";

import { JourneyProvider, PreparedJourneyProvider, useJourney } from "../ui/JourneyProvider";
import type { JourneyDraft } from "../domain/types";
import type { JourneyRuntime, JourneyRuntimeMode } from "./journey-runtime";

export type JourneyRuntimeContextValue = {
  mode: JourneyRuntimeMode;
  journalPersistence: JourneyRuntime["journalPersistence"];
  snapshot: JourneyDraft | null;
  controller: JourneyRuntime["controller"];
  cards: JourneyRuntime["cards"];
  drafts: JourneyRuntime["drafts"];
  service: JourneyRuntime["service"];
  shellState: JourneyRuntime["shellState"];
  reviewHistory: JourneyRuntime["reviewHistory"];
  createJournalService: JourneyRuntime["createJournalService"];
  privacySettings: JourneyRuntime["privacySettings"];
  deleteAllData(): Promise<void>;
  runAndRefresh<T>(action: () => Promise<T>): Promise<T>;
  restart(): Promise<void>;
  replaceActiveReview(): Promise<void>;
  branchFromReview: JourneyRuntime["branchFromReview"];
};

export type AdultDeclarationContextValue = {
  status: "public" | "authorized";
  confirmAdult(): Promise<void>;
  deleteAllData?(): Promise<void>;
};

type JourneyRuntimeProviderProps = PropsWithChildren<{
  createRuntime(): Promise<JourneyRuntime>;
}>;

type RuntimeState =
  | { status: "loading" }
  | { status: "authorization-checking"; runtime: JourneyRuntime }
  | { status: "public"; runtime: JourneyRuntime }
  | { status: "authorized"; runtime: JourneyRuntime }
  | { status: "authorization-error"; runtime: JourneyRuntime }
  | { status: "draft-recovery-required"; runtime: JourneyRuntime }
  | { status: "storage-recovery-required"; runtime: JourneyRuntime }
  | { status: "deleting"; runtime: JourneyRuntime }
  | { status: "deletion-error"; runtime: JourneyRuntime }
  | { status: "error"; code: "journey-runtime-creation-failed" };

const JourneyRuntimeContext = createContext<JourneyRuntimeContextValue | null>(null);
const AdultDeclarationContext = createContext<AdultDeclarationContextValue | null>(null);
const publicAppearancePreferences = new InMemoryAppearancePreferencesRepository();
class DraftRecoveryRequiredError extends Error {}

function DraftRecoveryScreen({ onReset }: { onReset(): Promise<void> }) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);
  return <View style={{ gap: 16 }}>
    <ErrorState title="本机旅程需要恢复" message="当前本机草稿版本无法继续使用。重置后可以安全重新开始。" />
    {failed ? <Text accessibilityRole="alert">重置失败，请重试。</Text> : null}
    <Button label="重置本机旅程" loading={pending} onPress={() => {
      if (inFlight.current) return;
      inFlight.current = true;
      setPending(true);
      setFailed(false);
      void onReset().catch(() => setFailed(true)).finally(() => { inFlight.current = false; setPending(false); });
    }} />
  </View>;
}

function RuntimeContextProvider({
  children,
  runtime,
  deleteRuntimeData,
  refreshAuthorization,
  active = true
}: PropsWithChildren<{
  runtime: JourneyRuntime;
  deleteRuntimeData(): Promise<void>;
  refreshAuthorization(): Promise<void>;
  active?: boolean;
}>) {
  const { runAndRefresh, snapshot } = useJourney();
  const preferences = useOptionalAccountPreferences();
  const preferredAddress = preferences?.preferences.addressPreference;
  useEffect(() => {
    if (!active || preferredAddress === undefined || snapshot === null || snapshot.addressPreference === preferredAddress) return;
    void runAndRefresh(() => runtime.service.applyAccountPreferences({ ageConfirmed: true, addressPreference: preferredAddress })).catch(() => undefined);
  }, [active, preferredAddress, runAndRefresh, runtime, snapshot]);
  const restart = useCallback(
    () => runAndRefresh(async () => {
      await runtime.service.resetJourney();
      if (preferences?.ready && preferences.preferences.ageConfirmed) {
        await runtime.service.confirmAdult();
        await runtime.service.applyAccountPreferences(preferences.preferences);
        return;
      }
      await runtime.adultDeclaration.deleteAdultDeclaration();
      await refreshAuthorization();
    }),
    [preferences, refreshAuthorization, runAndRefresh, runtime]
  );
  const deleteAllData = useCallback(
    () => runAndRefresh(deleteRuntimeData),
    [deleteRuntimeData, runAndRefresh]
  );
  const replaceActiveReview = useCallback(
    () => runAndRefresh(async () => {
      await runtime.replaceActiveReview();
      if (preferences?.ready && preferences.preferences.ageConfirmed) {
        await runtime.service.confirmAdult();
        await runtime.service.applyAccountPreferences(preferences.preferences);
      }
    }),
    [preferences, runAndRefresh, runtime]
  );
  const context = useMemo<JourneyRuntimeContextValue>(() => ({
    mode: runtime.mode,
    journalPersistence: runtime.journalPersistence,
    snapshot,
    controller: runtime.controller,
    cards: runtime.cards,
    drafts: runtime.drafts,
    service: runtime.service,
    shellState: runtime.shellState,
    reviewHistory: runtime.reviewHistory,
    createJournalService: runtime.createJournalService,
    privacySettings: runtime.privacySettings,
    deleteAllData,
    runAndRefresh,
    restart,
    replaceActiveReview,
    branchFromReview: runtime.branchFromReview
  }), [deleteAllData, replaceActiveReview, restart, runAndRefresh, runtime, snapshot]);

  return (
    <JourneyRuntimeContext.Provider value={active ? context : null}>
      {children}
    </JourneyRuntimeContext.Provider>
  );
}

function PublicBoundary({ children }: PropsWithChildren) {
  return (
    <ThemeProvider repository={publicAppearancePreferences}>
      {children}
    </ThemeProvider>
  );
}

function RecoveryDeleteScreen({
  mode,
  onDelete
}: {
  mode: "recovery" | "deleting" | "error";
  onDelete(): Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);

  if (mode === "deleting") {
    return (
      <View accessibilityLiveRegion="assertive">
        <Text accessibilityRole="alert">正在删除本机数据…</Text>
      </View>
    );
  }

  if (mode === "error") {
    return (
      <View style={{ gap: 16 }}>
        <ErrorState
          message="删除尚未完成。受限内容仍保持锁定，请安全重试。"
          title="本机数据删除尚未完成"
        />
        <Button label="重试删除" onPress={() => { void onDelete().catch(() => undefined); }} />
      </View>
    );
  }

  return (
    <View style={{ gap: 16 }}>
      <ErrorState
        message="本机加密数据库或安全密钥状态异常。为避免误删，应用不会自动清除任何内容。"
        title="本机加密数据需要恢复"
      />
      {confirming ? (
        <>
          <Text accessibilityRole="alert">
            请再次确认：全部本机数据会被删除，并且无法恢复。
          </Text>
          <Button
            label="确认删除全部本机数据"
            onPress={() => { void onDelete().catch(() => undefined); }}
          />
          <SecondaryButton label="取消删除" onPress={() => setConfirming(false)} />
        </>
      ) : (
        <Button label="删除全部本机数据" onPress={() => setConfirming(true)} />
      )}
    </View>
  );
}

function AuthorizationErrorScreen({ onRetry }: { onRetry(): void }) {
  return (
    <View style={{ gap: 16 }}>
      <ErrorState
        message="无法安全读取成年声明或本机删除状态。受限内容已保持锁定。"
        title="无法验证本机访问状态"
      />
      <Button label="重试检查" onPress={onRetry} />
    </View>
  );
}

export function JourneyRuntimeProvider({
  children,
  createRuntime
}: JourneyRuntimeProviderProps) {
  const preferences = useOptionalAccountPreferences();
  const preferencesRef = useRef(preferences);
  const auth = useOptionalAuth();
  const authRef = useRef(auth);
  authRef.current = auth;
  preferencesRef.current = preferences;
  const [authorizedOwner, setAuthorizedOwner] = useState<string | null | undefined>(undefined);
  const preferenceOperations = useRef<Promise<unknown>>(Promise.resolve());
  const [state, setState] = useState<RuntimeState>({ status: "loading" });
  const [runtimeAttempt, setRuntimeAttempt] = useState(0);
  const createRuntimeRef = useRef(createRuntime);
  const runtimePromiseRef = useRef<Promise<JourneyRuntime> | null>(null);
  const adultConfirmationRef = useRef<Promise<void> | null>(null);
  const deletionPromiseRef = useRef<Promise<void> | null>(null);

  const setAuthorizationFromMarker = useCallback(async (runtime: JourneyRuntime) => {
    setState({ status: "authorization-checking", runtime });
    try {
      const [declared, deletionPending] = await Promise.all([
        runtime.adultDeclaration.hasAdultDeclaration(),
        runtime.adultDeclaration.hasPendingLocalDataDeletion()
      ]);
      setState({ status: declared && !deletionPending ? "authorized" : "public", runtime });
    } catch {
      setState({ status: "authorization-error", runtime });
      throw new Error("journey-authorization-read-failed");
    }
  }, []);

  const deleteRuntimeData = useCallback((runtime: JourneyRuntime) => {
    if (deletionPromiseRef.current !== null) return deletionPromiseRef.current;
    setState({ status: "deleting", runtime });
    const deletion = Promise.resolve().then(async () => {
      await authRef.current?.clearLocalSession();
      await preferenceOperations.current;
      await preferencesRef.current?.clear();
      await runtime.deleteAllData();
    })
      .then(() => {
        setState({ status: "public", runtime });
      })
      .catch((error: unknown) => {
        setState({ status: "deletion-error", runtime });
        throw error;
      })
      .finally(() => {
        if (deletionPromiseRef.current === deletion) deletionPromiseRef.current = null;
      });
    deletionPromiseRef.current = deletion;
    return deletion;
  }, []);

  const handleStorageRecoveryRequired = useCallback(() => {
    if (state.status === "authorized") {
      setState({ status: "storage-recovery-required", runtime: state.runtime });
    }
  }, [state]);

  const retryRuntimeCreation = useCallback(() => {
    runtimePromiseRef.current = null;
    setState({ status: "loading" });
    setRuntimeAttempt((attempt) => attempt + 1);
  }, []);

  useEffect(() => {
    runtimePromiseRef.current ??= Promise.resolve().then(createRuntimeRef.current);
    const runtimePromise = runtimePromiseRef.current;
    let active = true;

    void runtimePromise.then(async (runtime) => {
      try {
        const [declared, deletionPending] = await Promise.all([
          runtime.adultDeclaration.hasAdultDeclaration(),
          runtime.adultDeclaration.hasPendingLocalDataDeletion()
        ]);
        const accountPreferences = preferencesRef.current;
        if (accountPreferences !== null) {
          if (declared && !deletionPending) {
            const recovery = await runtime.service.initialize();
            if (recovery !== "ready") throw new DraftRecoveryRequiredError();
          }
          await accountPreferences.initialize({
            ageConfirmed: declared && !deletionPending && (runtime.mode !== "expo-go-demo" || runtime.service.getSnapshot()?.ageConfirmed === true),
            addressPreference: declared && !deletionPending ? runtime.service.getSnapshot()?.addressPreference ?? null : null,
          });
          if (deletionPending) await accountPreferences.clear();
        }
        if (active) {
          setState({ status: accountPreferences === null && declared && !deletionPending ? "authorized" : "public", runtime });
        }
      } catch (error) {
        if (active) setState({ status: error instanceof DraftRecoveryRequiredError ? "draft-recovery-required" : error instanceof DatabaseRecoveryRequiredError ? "storage-recovery-required" : "authorization-error", runtime });
      }
    }).catch(
      () => {
        if (active) setState({ status: "error", code: "journey-runtime-creation-failed" });
      }
    );

    return () => { active = false; };
  }, [runtimeAttempt]);

  const preferenceRuntime = "runtime" in state ? state.runtime : null;
  const deletionAccountId = auth?.accountId;
  const deletionAuthenticated = auth?.status === "signedIn" || auth?.status === "offline";
  const accountJournalDeletion = useMemo(() => {
    if (preferenceRuntime === null || deletionAccountId === undefined || !deletionAuthenticated) return null;
    const guard = () => {
      const current = authRef.current;
      if (current?.accountId !== deletionAccountId || (current.status !== "signedIn" && current.status !== "offline") || deletionPromiseRef.current !== null) {
        throw new Error("journal-deletion-account-unavailable");
      }
    };
    const service = preferenceRuntime.createJournalService(deletionAccountId);
    return {
      accountId: deletionAccountId,
      journalPersistence: preferenceRuntime.journalPersistence,
      ensureDeletionCleanup: async () => { guard(); return await service.ensureDeletionCleanup(); },
      clearCurrentAccount: async () => { guard(); await service.clearCurrentAccount(); },
    };
  }, [deletionAccountId, deletionAuthenticated, preferenceRuntime]);
  const preferenceReady = preferences?.ready;
  const preferenceAdult = preferences?.preferences.ageConfirmed;
  const preferenceOwner = preferences?.owner;
  const canReconcilePreferences = state.status === "public" || state.status === "authorized";
  useEffect(() => {
    if (preferenceRuntime === null || !preferenceReady || !canReconcilePreferences) return;
    let active = true;
    const isCurrent = () => active && deletionPromiseRef.current === null;
    const operation = preferenceOperations.current.then(async () => {
      if (!isCurrent()) return;
      if (!preferenceAdult) {
        await preferenceRuntime.adultDeclaration.deleteAdultDeclaration();
        await preferenceRuntime.service.applyAccountPreferences({ ageConfirmed: false, addressPreference: preferencesRef.current!.preferences.addressPreference });
        if (isCurrent()) { setAuthorizedOwner(preferenceOwner); setState({ status: "public", runtime: preferenceRuntime }); }
        return;
      }
      if (await preferenceRuntime.adultDeclaration.hasPendingLocalDataDeletion()) return;
      const recovery = await preferenceRuntime.service.initialize();
      if (recovery !== "ready") throw new DraftRecoveryRequiredError();
      if (!isCurrent()) return;
      if (preferenceRuntime.service.getSnapshot() !== null || await preferenceRuntime.shellState.load() === null) {
        await preferenceRuntime.service.confirmAdult();
      }
      await preferenceRuntime.service.applyAccountPreferences(preferencesRef.current!.preferences);
      if (!isCurrent()) return;
      await preferenceRuntime.adultDeclaration.recordAdultDeclaration();
      if (isCurrent()) { setAuthorizedOwner(preferenceOwner); setState({ status: "authorized", runtime: preferenceRuntime }); }
    });
    preferenceOperations.current = operation.catch(() => undefined);
    void operation.catch((error: unknown) => {
      if (isCurrent()) setState({ status: error instanceof DraftRecoveryRequiredError ? "draft-recovery-required" : error instanceof DatabaseRecoveryRequiredError ? "storage-recovery-required" : "authorization-error", runtime: preferenceRuntime });
    });
    return () => { active = false; };
  }, [canReconcilePreferences, preferenceRuntime, preferenceReady, preferenceAdult, preferenceOwner]);

  const confirmAdult = useCallback(() => {
    if (preferencesRef.current !== null) return (async () => {
      await preferencesRef.current!.change({ ageConfirmed: true });
      if (state.status === "authorized") {
        await state.runtime.service.confirmAdult();
        await state.runtime.service.applyAccountPreferences(preferencesRef.current!.preferences);
      }
    })();
    if (state.status !== "public" && state.status !== "authorized") {
      return Promise.reject(new Error("journey-runtime-not-ready"));
    }
    if (
      state.status === "authorized"
      && state.runtime.service.getSnapshot()?.ageConfirmed === true
    ) return Promise.resolve();
    if (adultConfirmationRef.current !== null) return adultConfirmationRef.current;

    const runtime = state.runtime;
    const confirmation = (async () => {
      if (state.status === "public") {
        let recoveryState;
        try {
          recoveryState = await runtime.service.initialize();
        } catch (error) {
          if (error instanceof DatabaseRecoveryRequiredError) {
            setState({ status: "storage-recovery-required", runtime });
          }
          throw error;
        }
        if (recoveryState !== "ready") throw new Error("journey-recovery-required");
      }
      await runtime.service.confirmAdult();
      await runtime.adultDeclaration.recordAdultDeclaration();
      if (state.status === "public") setState({ status: "authorized", runtime });
    })();
    adultConfirmationRef.current = confirmation;
    void confirmation.finally(() => {
      if (adultConfirmationRef.current === confirmation) adultConfirmationRef.current = null;
    }).catch(() => undefined);
    return confirmation;
  }, [state]);

  if (state.status === "loading") {
    return <Text accessibilityLiveRegion="polite">正在启动旅程运行时…</Text>;
  }
  if (state.status === "authorization-checking") {
    return <Text accessibilityLiveRegion="polite">正在检查本机访问状态…</Text>;
  }
  if (state.status === "error") {
    return (
      <PublicBoundary>
        <View accessibilityRole="alert" style={{ gap: 16 }}>
          <Text accessibilityRole="header">无法启动旅程运行时</Text>
          <Text>错误代码：{state.code}</Text>
          <Button label="重试启动" onPress={retryRuntimeCreation} />
        </View>
      </PublicBoundary>
    );
  }
  if (state.status === "authorization-error") {
    return (
      <PublicBoundary>
        <AuthorizationErrorScreen
          onRetry={() => {
            if (preferencesRef.current !== null) {
              setState({ status: "loading" });
              setRuntimeAttempt((attempt) => attempt + 1);
              preferencesRef.current.retry();
            } else void setAuthorizationFromMarker(state.runtime).catch(() => undefined);
          }}
        />
      </PublicBoundary>
    );
  }
  if (
    state.status === "storage-recovery-required"
    || state.status === "deleting"
    || state.status === "deletion-error"
  ) {
    const mode = state.status === "storage-recovery-required"
      ? "recovery"
      : state.status === "deleting" ? "deleting" : "error";
    return (
      <PublicBoundary>
        <RecoveryDeleteScreen
          mode={mode}
          onDelete={() => deleteRuntimeData(state.runtime)}
        />
      </PublicBoundary>
    );
  }

  if (state.status === "draft-recovery-required") {
    return <PublicBoundary>
      <DraftRecoveryScreen onReset={async () => {
        await state.runtime.service.resetJourney();
        setState({ status: "loading" });
        setRuntimeAttempt((attempt) => attempt + 1);
      }} />
    </PublicBoundary>;
  }

  const effectiveStatus = preferences !== null && (!preferences.ready || !preferences.preferences.ageConfirmed || authorizedOwner !== preferences.owner)
    ? "public" : state.status;
  const adultDeclaration = {
    status: effectiveStatus, confirmAdult,
    ...(preferences === null ? {} : { deleteAllData: () => deleteRuntimeData(state.runtime) }),
  } satisfies AdultDeclarationContextValue;
  if (preferences !== null) {
    return (
      <AccountJournalDeletionContext.Provider value={accountJournalDeletion}>
        <ThemeProvider repository={effectiveStatus === "authorized" ? state.runtime.appearancePreferences : publicAppearancePreferences}>
          <AdultDeclarationContext.Provider value={adultDeclaration}>
            <PreparedJourneyProvider service={state.runtime.service} active={effectiveStatus === "authorized"} owner={preferences.owner}>
              <RuntimeContextProvider
                active={effectiveStatus === "authorized"}
                deleteRuntimeData={() => deleteRuntimeData(state.runtime)}
                refreshAuthorization={() => setAuthorizationFromMarker(state.runtime)}
                runtime={state.runtime}
              >
                {children}
              </RuntimeContextProvider>
            </PreparedJourneyProvider>
          </AdultDeclarationContext.Provider>
        </ThemeProvider>
      </AccountJournalDeletionContext.Provider>
    );
  }
  if (effectiveStatus === "public") {
    return (
      <AccountJournalDeletionContext.Provider value={accountJournalDeletion}>
      <PublicBoundary>
        <AdultDeclarationContext.Provider value={adultDeclaration}>
          {children}
        </AdultDeclarationContext.Provider>
      </PublicBoundary>
      </AccountJournalDeletionContext.Provider>
    );
  }

  return (
    <AccountJournalDeletionContext.Provider value={accountJournalDeletion}>
    <ThemeProvider repository={state.runtime.appearancePreferences}>
      <AdultDeclarationContext.Provider value={adultDeclaration}>
        <JourneyProvider
          onStorageRecoveryRequired={handleStorageRecoveryRequired}
          service={state.runtime.service}
        >
          <RuntimeContextProvider
            deleteRuntimeData={() => deleteRuntimeData(state.runtime)}
            refreshAuthorization={() => setAuthorizationFromMarker(state.runtime)}
            runtime={state.runtime}
          >
            {children}
          </RuntimeContextProvider>
        </JourneyProvider>
      </AdultDeclarationContext.Provider>
    </ThemeProvider>
    </AccountJournalDeletionContext.Provider>
  );
}

export function useAdultDeclaration() {
  const context = useContext(AdultDeclarationContext);
  if (context === null) throw new Error("JourneyRuntimeProvider is required");
  return context;
}

export function useOptionalJourneyRuntime() {
  return useContext(JourneyRuntimeContext);
}

export function useJourneyRuntime() {
  const context = useContext(JourneyRuntimeContext);
  if (context === null) throw new Error("JourneyRuntimeProvider is required");
  return context;
}
