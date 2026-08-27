import { border, color, motion, radius, size, space, typography } from "./tokens";

export const darkTheme = Object.freeze({
  name: "dark" as const, color, typography, space, radius, size, border, motion,
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

export const theme = darkTheme;
export type Theme = typeof darkTheme;
