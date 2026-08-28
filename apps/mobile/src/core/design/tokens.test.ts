import { border, color, radius, size, space, tokens, typography } from "./tokens";
import { darkTheme, lightTheme, paperTheme } from "./theme";

describe("DARK/PAPER semantic design tokens", () => {
  it("uses the approved dark canvas, surface, brand, text, safety, and paper palette", () => {
    expect(color).toEqual(expect.objectContaining({
      canvasBase: "#171217", canvasSoft: "#1D161C", canvasRaised: "#211820",
      surface: "#241A22", surfaceRaised: "#30222D", surfaceSubtle: "#2A2028",
      border: "#4A3944", borderSoft: "#382B34", text: "#FAF5F7",
      textSecondary: "#CBBFC5", textTertiary: "#9F9098", brandDeep: "#6D345A",
      brandSoft: "#D7A0B5", brandLavender: "#927AA0", lightWarm: "#F2C7A5",
      infoMuted: "#6E667E", safetyMuted: "#A96068", disabledFill: "#30282E",
      disabledText: "#84777E", paperCanvas: "#FBF4F0", paperText: "#33262D",
      paperSecondary: "#745F69",
    }));
    expect(darkTheme.name).toBe("dark");
  });

  it("defines the approved warm-paper light palette with the same semantic contract", () => {
    expect(lightTheme.name).toBe("light");
    expect(lightTheme.color).toEqual(expect.objectContaining({
      background: "#FBF4F0",
      surface: "#FFFDFC",
      surfaceAccent: "#F2E3E9",
      text: "#33262D",
      textSecondary: "#745F69",
      primary: "#6D345A",
      primaryPressed: "#542342",
      focus: "#6D345A",
      success: "#2F6B50",
      warning: "#7C4A25",
      danger: "#9A3F4B",
    }));
    expect(Object.keys(lightTheme.color).sort()).toEqual(Object.keys(darkTheme.color).sort());
  });

  it("preserves the established flat semantic API as dark-role aliases", () => {
    expect(color.background).toBe(color.canvasBase);
    expect(color.surfaceMuted).toBe(color.surfaceSubtle);
    expect(color.surfaceAccent).toBe(color.surfaceRaised);
    expect(color.textMuted).toBe(color.textSecondary);
    expect(color.primary).toBe(color.brandSoft);
    expect(color.onPrimary).toBe(color.canvasBase);
    expect(color.focus).toBe(color.lightWarm);
    expect(color.disabled).toBe(color.disabledFill);
    expect(color.info).toBe(color.infoMuted);
    expect(color.interactiveBorder).toBe(color.brandLavender);
  });

  it("exposes a warm-paper preview theme without switching the app theme", () => {
    expect(paperTheme).toEqual({
      name: "paper",
      color: {
        canvas: "#FBF4F0",
        text: "#33262D",
        secondary: "#745F69",
        accent: "#6D345A",
      },
    });
    expect(Object.isFrozen(paperTheme)).toBe(true);
    expect(Object.isFrozen(paperTheme.color)).toBe(true);
  });

  it("defines the complete spacing scale and continuous radii", () => {
    expect(Object.values(space)).toEqual([0, 4, 8, 12, 16, 20, 24, 32, 40, 48]);
    expect(radius).toEqual(expect.objectContaining({ label: 10, control: 16, feature: 20, sheet: 24 }));
  });

  it("defines 44-point controls, 52-point primary actions, and 600-point reading width", () => {
    expect(size.minimumTouchTarget).toBe(44);
    expect(size.primaryActionHeight).toBe(52);
    expect(size.readableContentMax).toBe(600);
  });

  it("defines a two-pixel focus ring with a two-pixel offset", () => {
    expect(border.focusWidth).toBe(2);
    expect(border.focusOffset).toBe(2);
  });

  it("keeps every text role taller than its glyph size under text scaling", () => {
    for (const textStyle of Object.values(typography)) {
      expect(textStyle.lineHeight).toBeGreaterThan(textStyle.fontSize);
    }
  });

  it("freezes every token contract", () => {
    for (const group of [tokens, color, typography, space, radius, size, border, tokens.motion, darkTheme, lightTheme]) {
      expect(Object.isFrozen(group)).toBe(true);
    }
  });
});
