import { border, color, motion, radius, size, space, typography } from "./tokens";

export type ResolvedTheme = "light" | "dark";
export type ThemePreference = "system" | ResolvedTheme;

export type AppTheme = Readonly<{
  name: ResolvedTheme;
  color: Readonly<Record<keyof typeof color, string>>;
  typography: typeof typography;
  space: typeof space;
  radius: typeof radius;
  size: typeof size;
  border: typeof border;
  motion: typeof motion;
}>;

export const darkTheme: AppTheme = Object.freeze({
  name: "dark" as const, color, typography, space, radius, size, border, motion,
});

const lightColor: AppTheme["color"] = Object.freeze({
  canvasBase: "#FBF4F0",
  canvasSoft: "#F6EBE8",
  canvasRaised: "#FFF9F6",
  surface: "#FFFDFC",
  surfaceRaised: "#F2E3E9",
  surfaceSubtle: "#F7ECEF",
  border: "#C7B0BA",
  borderSoft: "#DDCDD4",
  text: "#33262D",
  textSecondary: "#745F69",
  textTertiary: "#745F69",
  brandDeep: "#6D345A",
  brandSoft: "#6D345A",
  brandLavender: "#70567C",
  lightWarm: "#7C4A25",
  infoMuted: "#5B526C",
  safetyMuted: "#9A3F4B",
  disabledFill: "#E7DCE1",
  disabledText: "#776A71",
  paperCanvas: color.paperCanvas,
  paperText: color.paperText,
  paperSecondary: color.paperSecondary,
  background: "#FBF4F0",
  surfaceMuted: "#F7ECEF",
  surfaceAccent: "#F2E3E9",
  surfacePressed: "#EADAE1",
  textMuted: "#745F69",
  primary: "#6D345A",
  onPrimary: "#FAF5F7",
  primaryPressed: "#542342",
  focus: "#6D345A",
  interactiveBorder: "#70567C",
  disabled: "#E7DCE1",
  info: "#5B526C",
  success: "#2F6B50",
  warning: "#7C4A25",
  error: "#9A3F4B",
  danger: "#9A3F4B",
  dangerSurface: "#FAE9EC",
  onDanger: "#7A2E39",
});

export const lightTheme: AppTheme = Object.freeze({
  name: "light", color: lightColor, typography, space, radius, size, border, motion,
});

export const paperTheme = Object.freeze({
  name: "paper" as const,
  color: Object.freeze({
    canvas: color.paperCanvas,
    text: color.paperText,
    secondary: color.paperSecondary,
    accent: color.brandDeep,
  }),
});

export type Theme = AppTheme;
