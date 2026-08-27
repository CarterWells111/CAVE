import { border, color, motion, radius, size, space, typography } from "./tokens";

export const lightTheme = Object.freeze({
  name: "light" as const,
  color,
  typography,
  space,
  radius,
  size,
  border,
  motion
});

export const theme = lightTheme;

export type Theme = typeof lightTheme;
