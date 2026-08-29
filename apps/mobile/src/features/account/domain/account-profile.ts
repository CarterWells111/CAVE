export const DEFAULT_ACCOUNT_DISPLAY_NAME = "内界用户";

export type AccountProfile = Readonly<{
  accountId: string;
  displayName: string;
  avatarUri?: string;
  updatedAt: string | null;
}>;
