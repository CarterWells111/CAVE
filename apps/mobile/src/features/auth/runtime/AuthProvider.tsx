import type {
  AccountDeletionGrantResponse,
  AuthSessionResponse,
  EmailChallengeAccepted,
} from "@cave/contracts";
import {
  createContext,
  type PropsWithChildren,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { MobileAuthApiError, type AuthApiClient } from "../infrastructure/auth-api-client";
import type { AuthSessionRecord, AuthSessionStore } from "../infrastructure/auth-session-store";

export type AuthDependencies = {
  api: AuthApiClient;
  sessionStore: AuthSessionStore;
  getInstallationToken(): Promise<string>;
  createRequestId(): string;
  now(): number;
};

type AdultStatus = "public" | "authorized";
type PublicStatus = "loading" | "signedOut" | "signedIn" | "offline";

type RuntimeSession = {
  record: AuthSessionRecord;
  accessToken?: string;
  accessExpiresAt?: string;
};

type PendingRefresh = {
  epoch: number;
  refreshToken: string;
  promise: Promise<AuthSessionResponse>;
};

type AuthContextValue = {
  status: PublicStatus;
  accountId?: string;
  email?: string;
  requestEmailChallenge(email: string): Promise<EmailChallengeAccepted>;
  verifyEmailChallenge(challengeId: string, code: string, email: string): Promise<void>;
  logout(): Promise<void>;
  clearLocalSession(): Promise<void>;
  requestAccountDeletionChallenge(email: string): Promise<EmailChallengeAccepted>;
  verifyAccountDeletionChallenge(challengeId: string, code: string): Promise<AccountDeletionGrantResponse>;
  createAccountDeletionIdempotencyKey(): string;
  deleteAccount(deletionGrant: string, idempotencyKey: string): Promise<void>;
};

export class LocalAuthError extends Error {
  constructor(readonly code: "ADULT_DECLARATION_REQUIRED" | "AUTH_UNAUTHORIZED") {
    super("Authentication action unavailable");
    this.name = "LocalAuthError";
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

function recordFrom(response: AuthSessionResponse, email?: string): AuthSessionRecord {
  return {
    accountId: response.account.id,
    ...(email === undefined ? {} : { email }),
    refreshToken: response.session.refreshToken,
    refreshExpiresAt: response.session.refreshExpiresAt,
  };
}

export function AuthProvider({
  adultStatus,
  dependencies,
  children,
}: PropsWithChildren<{ adultStatus: AdultStatus; dependencies: AuthDependencies }>) {
  const [status, setStatus] = useState<PublicStatus>("loading");
  const sessionRef = useRef<RuntimeSession | null>(null);
  const sessionEpochRef = useRef(0);
  const sessionMutationRef = useRef<Promise<void>>(Promise.resolve());
  const pendingRefreshRef = useRef<PendingRefresh | null>(null);

  const enqueueSessionMutation = useCallback((operation: () => Promise<void>) => {
    const task = sessionMutationRef.current.then(operation, operation);
    sessionMutationRef.current = task.catch(() => undefined);
    return task;
  }, []);

  const adopt = useCallback(async (
    response: AuthSessionResponse,
    expectedEpoch: number,
    email?: string,
  ) => {
    const record = recordFrom(response, email);
    await enqueueSessionMutation(async () => {
      if (sessionEpochRef.current !== expectedEpoch) return;
      await dependencies.sessionStore.save(record);
      if (sessionEpochRef.current !== expectedEpoch) return;
      sessionRef.current = {
        record,
        accessToken: response.session.accessToken,
        accessExpiresAt: response.session.accessExpiresAt,
      };
      setStatus("signedIn");
    });
  }, [dependencies, enqueueSessionMutation]);

  const clearLocalSession = useCallback(async () => {
    const clearingEpoch = ++sessionEpochRef.current;
    sessionRef.current = null;
    setStatus("signedOut");
    await enqueueSessionMutation(async () => {
      if (sessionEpochRef.current === clearingEpoch) await dependencies.sessionStore.clear();
    });
  }, [dependencies, enqueueSessionMutation]);

  const refreshSession = useCallback((record: AuthSessionRecord, epoch: number) => {
    const pending = pendingRefreshRef.current;
    if (pending !== null && pending.epoch === epoch && pending.refreshToken === record.refreshToken) {
      return pending.promise;
    }
    const next: PendingRefresh = {
      epoch,
      refreshToken: record.refreshToken,
      promise: dependencies.api.refresh({
        contractVersion: "1",
        requestId: dependencies.createRequestId(),
        refreshToken: record.refreshToken,
      }),
    };
    pendingRefreshRef.current = next;
    void next.promise.finally(() => {
      if (pendingRefreshRef.current === next) pendingRefreshRef.current = null;
    }).catch(() => undefined);
    return next.promise;
  }, [dependencies]);

  useEffect(() => {
    let active = true;
    const epoch = sessionEpochRef.current;
    void (async () => {
      const clearStaleSession = () => enqueueSessionMutation(async () => {
        if (!active || sessionEpochRef.current !== epoch) return;
        try {
          await dependencies.sessionStore.clear();
        } catch {
          // A stale persisted record can be retried on the next launch.
        }
        if (!active || sessionEpochRef.current !== epoch) return;
        sessionRef.current = null;
        setStatus("signedOut");
      });
      let record: AuthSessionRecord | null;
      try {
        record = await dependencies.sessionStore.load();
      } catch {
        if (active && sessionEpochRef.current === epoch) {
          sessionRef.current = null;
          setStatus("signedOut");
        }
        return;
      }
      if (!active || sessionEpochRef.current !== epoch) return;
      if (record === null || record.refreshExpiresAt < new Date(dependencies.now()).toISOString()) {
        if (record === null) setStatus("signedOut");
        else await clearStaleSession();
        return;
      }
      sessionRef.current = { record };
      try {
        const response = await refreshSession(record, epoch);
        if (active && sessionEpochRef.current === epoch) await adopt(response, epoch, record.email);
      } catch (error) {
        if (!active || sessionEpochRef.current !== epoch) return;
        if (error instanceof MobileAuthApiError && error.status === 401) {
          await clearStaleSession();
        } else {
          setStatus("offline");
        }
      }
    })();
    return () => { active = false; };
  }, [adopt, dependencies, enqueueSessionMutation, refreshSession]);

  const requireAdult = useCallback(() => {
    if (adultStatus !== "authorized") throw new LocalAuthError("ADULT_DECLARATION_REQUIRED");
  }, [adultStatus]);

  const requestEmailChallenge = useCallback(async (email: string) => {
    requireAdult();
    return await dependencies.api.requestEmailChallenge({
      contractVersion: "1",
      requestId: dependencies.createRequestId(),
      email,
      installationToken: await dependencies.getInstallationToken(),
    });
  }, [dependencies, requireAdult]);

  const verifyEmailChallenge = useCallback(async (challengeId: string, code: string, email: string) => {
    requireAdult();
    const requestEpoch = sessionEpochRef.current;
    const response = await dependencies.api.verifyEmailChallenge(challengeId, {
      contractVersion: "1",
      requestId: dependencies.createRequestId(),
      code,
      installationToken: await dependencies.getInstallationToken(),
    });
    if (sessionEpochRef.current !== requestEpoch) throw new LocalAuthError("AUTH_UNAUTHORIZED");
    const loginEpoch = ++sessionEpochRef.current;
    await adopt(response, loginEpoch, email.trim().toLowerCase());
  }, [adopt, dependencies, requireAdult]);

  const ensureAccessToken = useCallback(async (): Promise<string> => {
    const session = sessionRef.current;
    if (session === null) throw new LocalAuthError("AUTH_UNAUTHORIZED");
    if (
      session.accessToken !== undefined
      && session.accessExpiresAt !== undefined
      && Date.parse(session.accessExpiresAt) > dependencies.now() + 5_000
    ) return session.accessToken;
    const epoch = sessionEpochRef.current;
    try {
      const response = await refreshSession(session.record, epoch);
      await adopt(response, epoch, session.record.email);
      if (sessionEpochRef.current !== epoch) throw new LocalAuthError("AUTH_UNAUTHORIZED");
      return response.session.accessToken;
    } catch (error) {
      if (
        sessionEpochRef.current === epoch
        && error instanceof MobileAuthApiError
        && error.status === 401
      ) await clearLocalSession();
      throw error;
    }
  }, [adopt, clearLocalSession, dependencies, refreshSession]);

  const logout = useCallback(async () => {
    const record = sessionRef.current?.record ?? await dependencies.sessionStore.load();
    await clearLocalSession();
    if (record !== null) {
      try {
        await dependencies.api.logout({
          contractVersion: "1",
          requestId: dependencies.createRequestId(),
          refreshToken: record.refreshToken,
        });
      } catch {
        // Device logout is local-first; an unreachable server session expires naturally.
      }
    }
  }, [clearLocalSession, dependencies]);

  const requestAccountDeletionChallenge = useCallback(async (email: string) => {
    requireAdult();
    return await dependencies.api.requestAccountDeletionChallenge(
      await ensureAccessToken(),
      {
        contractVersion: "1",
        requestId: dependencies.createRequestId(),
        email,
        installationToken: await dependencies.getInstallationToken(),
      },
    );
  }, [dependencies, ensureAccessToken, requireAdult]);

  const verifyAccountDeletionChallenge = useCallback(async (challengeId: string, code: string) => (
    await dependencies.api.verifyAccountDeletionChallenge(challengeId, {
      contractVersion: "1",
      requestId: dependencies.createRequestId(),
      code,
      installationToken: await dependencies.getInstallationToken(),
    })
  ), [dependencies]);

  const deleteAccount = useCallback(async (deletionGrant: string, idempotencyKey: string) => {
    await dependencies.api.deleteAccount({
      contractVersion: "1",
      requestId: dependencies.createRequestId(),
      deletionGrant,
      idempotencyKey,
    });
    await clearLocalSession();
  }, [clearLocalSession, dependencies]);

  const createAccountDeletionIdempotencyKey = useCallback(() => (
    `mobile-delete-${dependencies.createRequestId()}`
  ), [dependencies]);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    ...(sessionRef.current === null ? {} : { accountId: sessionRef.current.record.accountId }),
    ...(
      (status === "signedIn" || status === "offline")
      && sessionRef.current?.record.email !== undefined
        ? { email: sessionRef.current.record.email }
        : {}
    ),
    requestEmailChallenge,
    verifyEmailChallenge,
    logout,
    clearLocalSession,
    requestAccountDeletionChallenge,
    verifyAccountDeletionChallenge,
    createAccountDeletionIdempotencyKey,
    deleteAccount,
  }), [
    clearLocalSession, createAccountDeletionIdempotencyKey, deleteAccount, logout, requestAccountDeletionChallenge,
    requestEmailChallenge, status, verifyAccountDeletionChallenge, verifyEmailChallenge,
  ]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useOptionalAuth();
  if (value === null) throw new Error("AuthProvider is required");
  return value;
}

export function useOptionalAuth(): AuthContextValue | null {
  return use(AuthContext);
}
