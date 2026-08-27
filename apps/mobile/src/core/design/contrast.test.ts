import { lightTheme } from "./theme";

type RGB = readonly [red: number, green: number, blue: number];

function hexToRgb(hex: string): RGB {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) {
    throw new Error(`Expected a six-digit sRGB hex color, received ${hex}`);
  }

  return [
    Number.parseInt(match[1]!, 16),
    Number.parseInt(match[2]!, 16),
    Number.parseInt(match[3]!, 16)
  ];
}

function linearize(channel: number): number {
  const srgb = channel / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const [red, green, blue] = hexToRgb(hex).map(linearize) as unknown as RGB;
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first: string, second: string): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

describe("light-theme WCAG sRGB contrast", () => {
  it.each([
    ["background", lightTheme.color.background],
    ["surface", lightTheme.color.surface],
    ["muted surface", lightTheme.color.surfaceMuted],
    ["accent surface", lightTheme.color.surfaceAccent],
    ["pressed surface", lightTheme.color.surfacePressed],
    ["danger surface", lightTheme.color.dangerSurface]
  ])("keeps body text on %s at 4.5:1 or greater", (_name, background) => {
    expect(contrastRatio(lightTheme.color.text, background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["background", lightTheme.color.background],
    ["surface", lightTheme.color.surface],
    ["muted surface", lightTheme.color.surfaceMuted]
  ])("keeps muted body text on %s at 4.5:1 or greater", (_name, background) => {
    expect(contrastRatio(lightTheme.color.textMuted, background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["primary on background", lightTheme.color.primary, lightTheme.color.background],
    ["primary on surface", lightTheme.color.primary, lightTheme.color.surface],
    ["on-primary", lightTheme.color.onPrimary, lightTheme.color.primary],
    ["on-primary on pressed primary", lightTheme.color.onPrimary, lightTheme.color.primaryPressed],
    ["on-danger", lightTheme.color.onDanger, lightTheme.color.danger]
  ])("keeps interactive or large text %s at 3:1 or greater", (_name, foreground, background) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(3);
  });

  it.each([
    ["info on banner", lightTheme.color.info, lightTheme.color.surfaceMuted],
    ["info action", lightTheme.color.info, lightTheme.color.surface],
    ["info pressed action", lightTheme.color.info, lightTheme.color.surfacePressed],
    ["success on banner", lightTheme.color.success, lightTheme.color.surfaceMuted],
    ["success action", lightTheme.color.success, lightTheme.color.surface],
    ["success pressed action", lightTheme.color.success, lightTheme.color.surfacePressed],
    ["warning on banner", lightTheme.color.warning, lightTheme.color.surfaceMuted],
    ["warning action", lightTheme.color.warning, lightTheme.color.surface],
    ["warning pressed action", lightTheme.color.warning, lightTheme.color.surfacePressed],
    ["error on banner", lightTheme.color.error, lightTheme.color.dangerSurface],
    ["error action", lightTheme.color.error, lightTheme.color.surface],
    ["error pressed action", lightTheme.color.error, lightTheme.color.surfacePressed]
  ])("keeps semantic status tone %s at 3:1 or greater", (_name, foreground, background) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(3);
  });

  it.each([
    ["border on background", lightTheme.color.border, lightTheme.color.background],
    ["border on surface", lightTheme.color.border, lightTheme.color.surface],
    ["border on muted surface", lightTheme.color.border, lightTheme.color.surfaceMuted],
    ["pressed border", lightTheme.color.border, lightTheme.color.surfacePressed],
    ["selected border", lightTheme.color.primary, lightTheme.color.surfaceAccent],
    ["pressed primary on background", lightTheme.color.primaryPressed, lightTheme.color.background],
    ["pressed primary on surface", lightTheme.color.primaryPressed, lightTheme.color.surface],
    ["focus on background", lightTheme.color.focus, lightTheme.color.background],
    ["focus on surface", lightTheme.color.focus, lightTheme.color.surface],
    ["focus on muted surface", lightTheme.color.focus, lightTheme.color.surfaceMuted],
    ["focus on accent surface", lightTheme.color.focus, lightTheme.color.surfaceAccent],
    ["focus on pressed surface", lightTheme.color.focus, lightTheme.color.surfacePressed],
    ["focus on danger surface", lightTheme.color.focus, lightTheme.color.dangerSurface]
  ])("keeps the non-text %s boundary at 3:1 or greater", (_name, boundary, background) => {
    expect(contrastRatio(boundary, background)).toBeGreaterThanOrEqual(3);
  });
});
