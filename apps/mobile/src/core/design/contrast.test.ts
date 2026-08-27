import { color } from "./tokens";

function luminance(hex: string): number {
  const values = hex.slice(1).match(/.{2}/gu)!.map((value) => Number.parseInt(value, 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * values[0]! + 0.7152 * values[1]! + 0.0722 * values[2]!;
}

function contrast(first: string, second: string): number {
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

describe("approved DARK/PAPER WCAG pairings", () => {
  it.each([
    ["primary/base", color.text, color.canvasBase],
    ["primary/soft", color.text, color.canvasSoft],
    ["primary/raised canvas", color.text, color.canvasRaised],
    ["primary/surface", color.text, color.surface],
    ["primary/raised surface", color.text, color.surfaceRaised],
    ["primary/subtle surface", color.text, color.surfaceSubtle],
    ["secondary/base", color.textSecondary, color.canvasBase],
    ["secondary/surface", color.textSecondary, color.surface],
    ["button", color.onPrimary, color.primary],
    ["button pressed", color.onPrimary, color.primaryPressed],
    ["paper body", color.paperText, color.paperCanvas],
    ["paper secondary", color.paperSecondary, color.paperCanvas],
  ])("keeps normal text %s at 4.5:1 or greater", (_name, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["focus/base", color.focus, color.canvasBase],
    ["focus/surface", color.focus, color.surface],
    ["selected/surface", color.primary, color.surface],
    ["selected/raised surface", color.primary, color.surfaceRaised],
    ["info/surface", color.info, color.surface],
    ["safety/surface", color.safetyMuted, color.surface],
    ["disabled label/fill", color.disabledText, color.disabledFill],
    ["interactive border/base", color.interactiveBorder, color.canvasBase],
    ["interactive border/surface", color.interactiveBorder, color.surface],
    ["default info line/surface", color.brandLavender, color.surface],
    ["education info line/surface", color.infoMuted, color.surface],
  ])("keeps large text or non-text %s at 3:1 or greater", (_name, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(3);
  });
});
