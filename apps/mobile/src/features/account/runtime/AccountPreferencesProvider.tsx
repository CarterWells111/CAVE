import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AppState } from "react-native";

import { useAuth } from "../../auth/runtime/AuthProvider";
import { AccountPreferencesService, type PreferenceChanges, type PreferenceValues, type PreferencesSnapshot } from "../application/account-preferences-service";
import { createExpoAccountPreferencesService } from "../infrastructure/expo-account-preferences";

export type AccountPreferencesContextValue = PreferencesSnapshot & {
  error: boolean;
  initialize(legacy: PreferenceValues): Promise<void>;
  change(changes: PreferenceChanges): Promise<void>;
  clear(): Promise<void>;
  retry(): void;
};
const Context = createContext<AccountPreferencesContextValue | null>(null);

export function AccountPreferencesProvider({ children, service: supplied }: PropsWithChildren<{ service?: AccountPreferencesService }>) {
  const serviceRef = useRef<AccountPreferencesService | null>(null);
  if (serviceRef.current === null) serviceRef.current = supplied ?? createExpoAccountPreferencesService();
  const service = serviceRef.current;
  const auth = useAuth();
  const snapshot = useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const owner = auth.status === "signedIn" || auth.status === "offline" ? auth.accountId ?? null : null;
  const authRef = useRef(auth);
  authRef.current = auth;
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const initialize = useCallback((legacy: PreferenceValues) => service.initialize(legacy), [service]);

  useEffect(() => {
    if (!snapshot.initialized || auth.status === "loading") return;
    let active = true;
    setError(false);
    void service.activate(owner).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [auth.status === "loading", owner, service, snapshot.initialized, attempt]);

  const sync = useCallback(async () => {
    const current = authRef.current;
    const id = current.accountId;
    if (id === undefined || (current.status !== "signedIn" && current.status !== "offline") || service.getSnapshot().owner !== id) return;
    await service.sync({
      get: () => current.getAccountPreferences(id),
      update: (revision, changes) => current.updateAccountPreferences(id, revision, changes),
    });
  }, [service]);
  useEffect(() => {
    if (snapshot.ready && snapshot.owner === owner && snapshot.syncStatus === "pending") void sync();
  }, [owner, snapshot.ready, snapshot.owner, snapshot.syncStatus, sync]);
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => { if (state === "active") void sync(); });
    return () => listener.remove();
  }, [sync]);
  const change = useCallback((changes: PreferenceChanges) => service.change(changes), [service]);
  const clear = useCallback(() => service.clear(), [service]);
  const ready = snapshot.ready && snapshot.owner === owner && auth.status !== "loading" && !error;
  const value = useMemo(() => ({ ...snapshot, ready, error, initialize, change, clear, retry }), [snapshot, ready, error, initialize, change, clear, retry]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useOptionalAccountPreferences = () => useContext(Context);
