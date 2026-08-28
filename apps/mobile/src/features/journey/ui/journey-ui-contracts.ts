export type JourneyAsyncState = {
  status: "idle" | "loading" | "success" | "error";
  message?: string;
};

export type JourneyRuntimeNotice = {
  message: string;
  accessibilityLabel?: string;
};

export type JourneyCapabilities = {
  canPersistLocally?: boolean;
  canCopy?: boolean;
  canShowFullscreen?: boolean;
};

export type JourneyAction = () => void | Promise<void>;
