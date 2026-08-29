import {
  createContext,
  type PropsWithChildren,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "../../auth/runtime/AuthProvider";
import type { JournalPersistence } from "../../journey/runtime/journey-runtime";
import { useOptionalJourneyRuntime } from "../../journey/runtime/JourneyRuntimeProvider";
import type { JournalService } from "../application/journal-service";

export type JournalAccessStatus = "locked" | "loading" | "ready" | "error";

export type JournalAccessContextValue = {
  status: JournalAccessStatus;
  accountId?: string;
  service?: JournalService;
  journalPersistence: JournalPersistence;
  retry(): void;
  ensureDeletionCleanup(): Promise<boolean>;
  clearCurrentAccount(): Promise<void>;
};

type ServiceState =
  | { status: "loading"; accountId: string }
  | { status: "ready"; accountId: string; service: JournalService }
  | { status: "error"; accountId: string };

const JournalAccessContext = createContext<JournalAccessContextValue | null>(null);

export function JournalAccessProvider({ children }: PropsWithChildren) {
  const auth = useAuth();
  const runtime = useOptionalJourneyRuntime();
  const [attempt, setAttempt] = useState(0);
  const [serviceState, setServiceState] = useState<ServiceState | null>(null);
  const accountId = auth.accountId;
  const authenticated = auth.status === "signedIn" || auth.status === "offline";

  useEffect(() => {
    if (!authenticated || accountId === undefined || runtime === null) return;
    const service = runtime.createJournalService(accountId);
    let active = true;
    setServiceState({ status: "loading", accountId });
    void service.claimLegacyRecords().then(
      () => { if (active) setServiceState({ status: "ready", accountId, service }); },
      () => { if (active) setServiceState({ status: "error", accountId }); },
    );
    return () => { active = false; };
  }, [accountId, attempt, authenticated, runtime]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const value = useMemo<JournalAccessContextValue>(() => {
    const journalPersistence = runtime?.journalPersistence ?? "memory-only";
    if (auth.status === "signedOut") {
      return {
        status: "locked",
        journalPersistence,
        retry,
        ensureDeletionCleanup: async () => { throw new Error("journal-auth-required"); },
        clearCurrentAccount: async () => { throw new Error("journal-auth-required"); },
      };
    }
    if (auth.status === "loading") {
      return {
        status: "loading",
        journalPersistence,
        retry,
        ensureDeletionCleanup: async () => { throw new Error("journal-auth-loading"); },
        clearCurrentAccount: async () => { throw new Error("journal-auth-loading"); },
      };
    }
    if (accountId === undefined || runtime === null) {
      return {
        status: "error",
        journalPersistence,
        retry,
        ensureDeletionCleanup: async () => { throw new Error("journal-runtime-unavailable"); },
        clearCurrentAccount: async () => { throw new Error("journal-runtime-unavailable"); },
      };
    }
    if (serviceState === null || serviceState.accountId !== accountId || serviceState.status === "loading") {
      return {
        status: "loading",
        accountId,
        journalPersistence,
        retry,
        ensureDeletionCleanup: async () => { throw new Error("journal-service-loading"); },
        clearCurrentAccount: async () => { throw new Error("journal-service-loading"); },
      };
    }
    if (serviceState.status === "error") {
      return {
        status: "error",
        accountId,
        journalPersistence,
        retry,
        ensureDeletionCleanup: async () => { throw new Error("journal-service-unavailable"); },
        clearCurrentAccount: async () => { throw new Error("journal-service-unavailable"); },
      };
    }
    return {
      status: "ready",
      accountId,
      service: serviceState.service,
      journalPersistence,
      retry,
      ensureDeletionCleanup: () => serviceState.service.ensureDeletionCleanup(),
      clearCurrentAccount: () => serviceState.service.clearCurrentAccount(),
    };
  }, [accountId, auth.status, retry, runtime, serviceState]);

  return <JournalAccessContext.Provider value={value}>{children}</JournalAccessContext.Provider>;
}

export function useJournalAccess(): JournalAccessContextValue {
  const value = use(JournalAccessContext);
  if (value === null) throw new Error("JournalAccessProvider is required");
  return value;
}

export function useReadyJournalService(): JournalService {
  const access = useJournalAccess();
  if (access.status !== "ready" || access.service === undefined) {
    throw new Error("JournalService is not ready");
  }
  return access.service;
}
