import * as ExpoImagePicker from "expo-image-picker";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useAuth } from "../../auth/runtime/AuthProvider";
import type { AccountProfile } from "../domain/account-profile";
import type { AccountProfileRepository } from "../infrastructure/account-profile-repository";
import { createExpoAccountProfileRepository } from "../infrastructure/expo-account-profile-dependencies";

export type AccountProfileError = "load" | "save" | "permission" | "picker";

export type AccountProfilePicker = {
  requestMediaLibraryPermissionsAsync(): Promise<{ granted: boolean }>;
  launchImageLibraryAsync(options: {
    allowsEditing: true;
    aspect: [number, number];
    mediaTypes: ["images"];
    quality: number;
  }): Promise<{
    canceled: boolean;
    assets: ReadonlyArray<{ uri: string }> | null;
  }>;
};

export type AccountProfileDependencies = {
  repository: AccountProfileRepository;
  picker: AccountProfilePicker;
};

export type AccountProfileContextValue = {
  status: "signedOut" | "loading" | "ready" | "error";
  accountId?: string;
  email?: string;
  profile?: AccountProfile;
  error: AccountProfileError | null;
  saveDisplayName(value: string): Promise<void>;
  chooseAvatar(): Promise<void>;
  removeAvatar(): Promise<void>;
  retry(): void;
};

type ProfileState = {
  accountId?: string;
  status: "loading" | "ready" | "error";
  profile?: AccountProfile;
  error: AccountProfileError | null;
};

const AccountProfileContext = createContext<AccountProfileContextValue | null>(null);

function createDefaultDependencies(): AccountProfileDependencies {
  return {
    repository: createExpoAccountProfileRepository(),
    picker: ExpoImagePicker as AccountProfilePicker,
  };
}

export function AccountProfileProvider({
  children,
  dependencies,
}: PropsWithChildren<{ dependencies?: AccountProfileDependencies }>) {
  const auth = useAuth();
  const defaultDependenciesRef = useRef<AccountProfileDependencies | null>(null);
  if (dependencies === undefined && defaultDependenciesRef.current === null) {
    defaultDependenciesRef.current = createDefaultDependencies();
  }
  const resolvedDependencies = dependencies ?? defaultDependenciesRef.current!;
  const { picker, repository } = resolvedDependencies;
  const authenticatedAccountId = (
    (auth.status === "signedIn" || auth.status === "offline")
    && auth.accountId !== undefined
  ) ? auth.accountId : undefined;
  const currentAccountIdRef = useRef(authenticatedAccountId);
  currentAccountIdRef.current = authenticatedAccountId;
  const operationTokenRef = useRef(0);
  const pickerTokenRef = useRef(0);
  const operationAccountIdRef = useRef(authenticatedAccountId);
  if (operationAccountIdRef.current !== authenticatedAccountId) {
    operationAccountIdRef.current = authenticatedAccountId;
    operationTokenRef.current += 1;
    pickerTokenRef.current += 1;
  }
  const [reloadVersion, setReloadVersion] = useState(0);
  const [state, setState] = useState<ProfileState>({ status: "loading", error: null });

  useEffect(() => {
    if (authenticatedAccountId === undefined) return;
    let active = true;
    setState({ accountId: authenticatedAccountId, status: "loading", error: null });
    void repository.load(authenticatedAccountId).then((profile) => {
      if (active && currentAccountIdRef.current === authenticatedAccountId) {
        setState({ accountId: authenticatedAccountId, status: "ready", profile, error: null });
      }
    }).catch(() => {
      if (active && currentAccountIdRef.current === authenticatedAccountId) {
        setState({ accountId: authenticatedAccountId, status: "error", error: "load" });
      }
    });
    return () => { active = false; };
  }, [authenticatedAccountId, reloadVersion, repository]);

  const applyMutation = useCallback(async (
    operation: (accountId: string) => Promise<AccountProfile>,
    operationToken: number,
  ) => {
    const accountId = authenticatedAccountId;
    if (
      accountId === undefined
      || state.accountId !== accountId
      || state.profile === undefined
      || operationTokenRef.current !== operationToken
    ) return;
    setState((current) => (
      current.accountId === accountId ? { ...current, error: null } : current
    ));
    try {
      const profile = await operation(accountId);
      if (
        currentAccountIdRef.current === accountId
        && operationTokenRef.current === operationToken
      ) {
        setState({ accountId, status: "ready", profile, error: null });
      }
    } catch {
      if (
        currentAccountIdRef.current === accountId
        && operationTokenRef.current === operationToken
      ) {
        setState((current) => (
          current.accountId === accountId ? { ...current, error: "save" } : current
        ));
        throw new Error("account-profile-save-failed");
      }
    }
  }, [authenticatedAccountId, state.accountId, state.profile]);

  const saveDisplayName = useCallback(async (value: string) => {
    const operationToken = ++operationTokenRef.current;
    await applyMutation(
      (accountId) => repository.saveDisplayName(accountId, value),
      operationToken,
    );
  }, [applyMutation, repository]);

  const chooseAvatar = useCallback(async () => {
    const pickerToken = ++pickerTokenRef.current;
    const accountId = authenticatedAccountId;
    if (accountId === undefined || state.accountId !== accountId || state.profile === undefined) return;
    setState((current) => (
      current.accountId === accountId ? { ...current, error: null } : current
    ));
    let permission: { granted: boolean };
    try {
      permission = await picker.requestMediaLibraryPermissionsAsync();
    } catch {
      if (
        currentAccountIdRef.current === accountId
        && pickerTokenRef.current === pickerToken
      ) {
        setState((current) => (
          current.accountId === accountId ? { ...current, error: "permission" } : current
        ));
      }
      return;
    }
    if (
      currentAccountIdRef.current !== accountId
      || pickerTokenRef.current !== pickerToken
    ) return;
    if (!permission.granted) {
      setState((current) => (
        current.accountId === accountId ? { ...current, error: "permission" } : current
      ));
      return;
    }
    try {
      const result = await picker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        mediaTypes: ["images"],
        quality: 0.85,
      });
      if (
        currentAccountIdRef.current !== accountId
        || pickerTokenRef.current !== pickerToken
        || result.canceled
      ) return;
      const uri = result.assets?.[0]?.uri;
      if (uri === undefined) {
        setState((current) => (
          current.accountId === accountId ? { ...current, error: "picker" } : current
        ));
        return;
      }
      const operationToken = ++operationTokenRef.current;
      await applyMutation(
        (currentAccountId) => repository.replaceAvatar(currentAccountId, uri),
        operationToken,
      );
    } catch {
      if (
        currentAccountIdRef.current === accountId
        && pickerTokenRef.current === pickerToken
      ) {
        setState((current) => (
          current.accountId === accountId ? { ...current, error: "picker" } : current
        ));
      }
    }
  }, [applyMutation, authenticatedAccountId, picker, repository, state.accountId, state.profile]);

  const removeAvatar = useCallback(async () => {
    pickerTokenRef.current += 1;
    const operationToken = ++operationTokenRef.current;
    await applyMutation((accountId) => repository.removeAvatar(accountId), operationToken);
  }, [applyMutation, repository]);

  const retry = useCallback(() => {
    if (authenticatedAccountId === undefined) return;
    operationTokenRef.current += 1;
    pickerTokenRef.current += 1;
    setState({ accountId: authenticatedAccountId, status: "loading", error: null });
    setReloadVersion((version) => version + 1);
  }, [authenticatedAccountId]);

  const visibleState = state.accountId === authenticatedAccountId ? state : undefined;
  const status: AccountProfileContextValue["status"] = auth.status === "loading"
    ? "loading"
    : auth.status === "signedOut"
      ? "signedOut"
      : authenticatedAccountId === undefined || visibleState === undefined
        ? "loading"
        : visibleState.status;

  const value = useMemo<AccountProfileContextValue>(() => ({
    status,
    ...(authenticatedAccountId === undefined ? {} : { accountId: authenticatedAccountId }),
    ...(
      authenticatedAccountId === undefined || auth.email === undefined
        ? {}
        : { email: auth.email }
    ),
    ...(
      visibleState?.profile === undefined ? {} : { profile: visibleState.profile }
    ),
    error: visibleState?.error ?? null,
    saveDisplayName,
    chooseAvatar,
    removeAvatar,
    retry,
  }), [
    auth.email,
    authenticatedAccountId,
    chooseAvatar,
    removeAvatar,
    retry,
    saveDisplayName,
    status,
    visibleState,
  ]);

  return <AccountProfileContext.Provider value={value}>{children}</AccountProfileContext.Provider>;
}

export function useAccountProfile(): AccountProfileContextValue {
  const value = useOptionalAccountProfile();
  if (value === null) throw new Error("AccountProfileProvider is required");
  return value;
}

export function useOptionalAccountProfile(): AccountProfileContextValue | null {
  return useContext(AccountProfileContext);
}
