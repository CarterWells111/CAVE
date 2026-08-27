export type MotionContract = Readonly<{
  duration: Readonly<{ instant: number; fast: number; standard: number; slow: number }>;
}>;

const palette = {
  canvasBase: "#171217", canvasSoft: "#1D161C", canvasRaised: "#211820",
  surface: "#241A22", surfaceRaised: "#30222D", surfaceSubtle: "#2A2028",
  border: "#4A3944", borderSoft: "#382B34", text: "#FAF5F7",
  textSecondary: "#CBBFC5", textTertiary: "#9F9098", brandDeep: "#6D345A",
  brandSoft: "#D7A0B5", brandLavender: "#927AA0", lightWarm: "#F2C7A5",
  infoMuted: "#6E667E", safetyMuted: "#A96068", disabledFill: "#30282E",
  disabledText: "#84777E", paperCanvas: "#FBF4F0", paperText: "#33262D",
  paperSecondary: "#745F69",
} as const;

export const color = Object.freeze({
  ...palette,
  background: palette.canvasBase,
  surfaceMuted: palette.surfaceSubtle,
  surfaceAccent: palette.surfaceRaised,
  surfacePressed: "#352730",
  textMuted: palette.textSecondary,
  primary: palette.brandSoft,
  onPrimary: palette.canvasBase,
  primaryPressed: "#C88EA7",
  focus: palette.lightWarm,
  interactiveBorder: palette.brandLavender,
  disabled: palette.disabledFill,
  info: palette.infoMuted,
  success: palette.brandSoft,
  warning: palette.lightWarm,
  error: palette.safetyMuted,
  danger: palette.safetyMuted,
  dangerSurface: palette.surfaceSubtle,
  onDanger: palette.text,
} as const);

const textStyle = <T extends { fontSize: number; lineHeight: number; fontWeight: string }>(value: T) =>
  Object.freeze(value);

export const typography = Object.freeze({
  brandEnglish: textStyle({ fontSize: 44, lineHeight: 48, fontWeight: "300" as const }),
  brandChinese: textStyle({ fontSize: 28, lineHeight: 36, fontWeight: "500" as const }),
  display: textStyle({ fontSize: 28, lineHeight: 38, fontWeight: "600" as const }),
  title: textStyle({ fontSize: 28, lineHeight: 38, fontWeight: "600" as const }),
  heading: textStyle({ fontSize: 20, lineHeight: 28, fontWeight: "600" as const }),
  cardTitle: textStyle({ fontSize: 17, lineHeight: 25, fontWeight: "500" as const }),
  body: textStyle({ fontSize: 16, lineHeight: 26, fontWeight: "400" as const }),
  label: textStyle({ fontSize: 12, lineHeight: 18, fontWeight: "500" as const }),
  button: textStyle({ fontSize: 16, lineHeight: 22, fontWeight: "500" as const }),
  caption: textStyle({ fontSize: 14, lineHeight: 22, fontWeight: "400" as const }),
  numericLabel: textStyle({ fontSize: 12, lineHeight: 16, fontWeight: "500" as const }),
});

export const space = Object.freeze({
  none: 0, xs: 4, sm: 8, compact: 12, md: 16, card: 20, lg: 24, xl: 32, section: 40, xxl: 48,
} as const);

export const radius = Object.freeze({
  sm: 10, md: 16, lg: 20, label: 10, control: 16, feature: 20, sheet: 24, pill: 999,
} as const);

export const size = Object.freeze({
  minimumTouchTarget: 44, primaryActionHeight: 52, secondaryActionHeight: 48,
  readableContentMax: 600, navigationHeight: 48, iconSmall: 16, icon: 20, iconLarge: 24,
} as const);

export const border = Object.freeze({ width: 1, selectedWidth: 2, focusWidth: 2, focusOffset: 2 } as const);

export const motion: MotionContract = Object.freeze({
  duration: Object.freeze({ instant: 0, fast: 120, standard: 200, slow: 260 }),
});

export const tokens = Object.freeze({ color, typography, space, radius, size, border, motion });
