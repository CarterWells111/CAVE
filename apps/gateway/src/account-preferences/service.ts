import type { AccountPreferencesResponse, UpdateAccountPreferencesRequest } from "@cave/contracts";
import { digestOpaqueToken } from "../auth/crypto";
import type { AuthRepository } from "../auth/repository";
import { AuthServiceError } from "../auth/service";
import type { AccountPreferencesRepository } from "./repository";

type Dependencies = {
  authRepository: Pick<AuthRepository, "findSessionByAccessDigest" | "findAccountById">;
  repository: AccountPreferencesRepository;
  now?: () => number;
};

export function createAccountPreferencesService({ authRepository, repository, now = Date.now }: Dependencies) {
  async function accountIdFor(accessToken: string): Promise<string> {
    const session = await authRepository.findSessionByAccessDigest(await digestOpaqueToken(accessToken));
    if (session === null || session.revokedAt !== undefined || Date.parse(session.accessExpiresAt) <= now()) {
      throw new AuthServiceError("AUTH_UNAUTHORIZED", 401);
    }
    if (await authRepository.findAccountById(session.accountId) === null) throw new AuthServiceError("AUTH_UNAUTHORIZED", 401);
    return session.accountId;
  }
  return {
    async get(accessToken: string, requestId: string): Promise<AccountPreferencesResponse> {
      const accountId = await accountIdFor(accessToken);
      return { contractVersion: "1", requestId, preferences: await repository.get(accountId) };
    },
    async update(accessToken: string, input: UpdateAccountPreferencesRequest): Promise<AccountPreferencesResponse> {
      const accountId = await accountIdFor(accessToken);
      const preferences = await repository.update(accountId, input, new Date(now()).toISOString());
      if (preferences === null) throw new AuthServiceError("ACCOUNT_PREFERENCES_CONFLICT", 409);
      return { contractVersion: "1", requestId: input.requestId, preferences };
    },
  };
}

export type AccountPreferencesService = ReturnType<typeof createAccountPreferencesService>;
