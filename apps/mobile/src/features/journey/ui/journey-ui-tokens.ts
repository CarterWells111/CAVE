export const journeyColors = {
  background: "#fffaf3",
  text: "#20302a",
  mutedText: "#4f5f58",
  border: "#697a72",
  actionBackground: "#155e58",
  actionText: "#ffffff",
  selectedBackground: "#d8eee7",
  selectedText: "#173f39",
  disabledBackground: "#e2e5e3",
  disabledText: "#52605b",
  noticeBackground: "#e8f1ee",
  noticeText: "#24443d",
  successBackground: "#dcefe2",
  successText: "#1f5130",
  errorBackground: "#fbe7e5",
  errorText: "#7a1f1a"
} as const;

export const journeySpacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32
} as const;

export const journeyRadii = {
  sm: 8,
  md: 12,
  pill: 999
} as const;

export const journeySizes = {
  minimumTouchTarget: 44
} as const;

export const journeyUiTokens = {
  colors: journeyColors,
  spacing: journeySpacing,
  radii: journeyRadii,
  sizes: journeySizes
} as const;
