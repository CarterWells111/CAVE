export type MotionContract = Readonly<{
  duration: Readonly<{
    instant: number;
    fast: number;
    standard: number;
    slow: number;
  }>;
}>;

export const color = Object.freeze({
  background: "#FFF9F6",
  surface: "#FFFFFF",
  surfaceMuted: "#F3E7E1",
  surfaceAccent: "#F8EAF1",
  surfacePressed: "#EAD8E1",
  text: "#2B1D24",
  textMuted: "#5F5057",
  primary: "#7A2852",
  onPrimary: "#FFFFFF",
  primaryPressed: "#5F183B",
  border: "#796A70",
  focus: "#6F1F4A",
  disabled: "#6F6569",
  info: "#245C78",
  success: "#24633F",
  warning: "#795800",
  error: "#9E2F3E",
  danger: "#9E2F3E",
  dangerSurface: "#FCE8EA",
  onDanger: "#FFFFFF"
} as const);

export const typography = Object.freeze({
  display: Object.freeze({ fontSize: 32, lineHeight: 40, fontWeight: "700" as const }),
  title: Object.freeze({ fontSize: 24, lineHeight: 32, fontWeight: "700" as const }),
  heading: Object.freeze({ fontSize: 20, lineHeight: 28, fontWeight: "600" as const }),
  body: Object.freeze({ fontSize: 16, lineHeight: 24, fontWeight: "400" as const }),
  label: Object.freeze({ fontSize: 16, lineHeight: 22, fontWeight: "600" as const }),
  button: Object.freeze({ fontSize: 16, lineHeight: 22, fontWeight: "600" as const }),
  caption: Object.freeze({ fontSize: 14, lineHeight: 20, fontWeight: "400" as const })
});

export const space = Object.freeze({
  none: 0,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48
} as const);

export const radius = Object.freeze({
  sm: 8,
  md: 12,
  lg: 20,
  pill: 999
} as const);

export const size = Object.freeze({
  minimumTouchTarget: 44,
  readableContentMax: 640,
  iconSmall: 16,
  icon: 20,
  iconLarge: 24
} as const);

export const border = Object.freeze({
  width: 1,
  focusWidth: 2
} as const);

export const motion: MotionContract = Object.freeze({
  duration: Object.freeze({
    instant: 0,
    fast: 120,
    standard: 200,
    slow: 320
  })
});

export const tokens = Object.freeze({
  color,
  typography,
  space,
  radius,
  size,
  border,
  motion
});
