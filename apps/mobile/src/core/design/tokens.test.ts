import {
  border,
  color,
  radius,
  size,
  space,
  tokens,
  typography
} from "./tokens";
import { lightTheme, theme } from "./theme";

describe("semantic design tokens", () => {
  it("defines the semantic light-theme color roles used by product UI", () => {
    expect(lightTheme.name).toBe("light");
    expect(lightTheme.color).toEqual(
      expect.objectContaining({
        background: expect.stringMatching(/^#[0-9A-F]{6}$/i),
        surface: expect.stringMatching(/^#[0-9A-F]{6}$/i),
        surfaceMuted: expect.stringMatching(/^#[0-9A-F]{6}$/i),
        surfaceAccent: expect.stringMatching(/^#[0-9A-F]{6}$/i),
        surfacePressed: expect.stringMatching(/^#[0-9A-F]{6}$/i),
        text: expect.stringMatching(/^#[0-9A-F]{6}$/i),
        textMuted: expect.stringMatching(/^#[0-9A-F]{6}$/i),
        primary: expect.stringMatching(/^#[0-9A-F]{6}$/i),
        onPrimary: expect.stringMatching(/^#[0-9A-F]{6}$/i),
        primaryPressed: expect.stringMatching(/^#[0-9A-F]{6}$/i),
        border: expect.stringMatching(/^#[0-9A-F]{6}$/i),
        focus: expect.stringMatching(/^#[0-9A-F]{6}$/i),
        disabled: expect.stringMatching(/^#[0-9A-F]{6}$/i),
        info: expect.stringMatching(/^#[0-9A-F]{6}$/i),
        success: expect.stringMatching(/^#[0-9A-F]{6}$/i),
        warning: expect.stringMatching(/^#[0-9A-F]{6}$/i),
        error: expect.stringMatching(/^#[0-9A-F]{6}$/i),
        danger: expect.stringMatching(/^#[0-9A-F]{6}$/i),
        dangerSurface: expect.stringMatching(/^#[0-9A-F]{6}$/i),
        onDanger: expect.stringMatching(/^#[0-9A-F]{6}$/i)
      })
    );
    expect(theme).toBe(lightTheme);
  });

  it("defines a 44-point minimum touch target and readable content width", () => {
    expect(size.minimumTouchTarget).toBeGreaterThanOrEqual(44);
    expect(size.readableContentMax).toBeGreaterThan(size.minimumTouchTarget);
    expect(lightTheme.size).toBe(size);
  });

  it("uses a visible non-zero focus boundary", () => {
    expect(border.width).toBeGreaterThan(0);
    expect(border.focusWidth).toBeGreaterThan(0);
    expect(border.focusWidth).toBeGreaterThanOrEqual(border.width);
  });

  it("uses line heights that remain legible when text scales", () => {
    for (const textStyle of Object.values(typography)) {
      expect(textStyle.lineHeight).toBeGreaterThanOrEqual(textStyle.fontSize * 1.2);
    }
  });

  it("exposes immutable semantic token groups", () => {
    expect(tokens).toEqual({ color, typography, space, radius, size, border, motion: tokens.motion });

    for (const group of [tokens, color, typography, space, radius, size, border, tokens.motion]) {
      expect(Object.isFrozen(group)).toBe(true);
    }

    for (const textStyle of Object.values(typography)) {
      expect(Object.isFrozen(textStyle)).toBe(true);
    }

    expect(Object.isFrozen(lightTheme)).toBe(true);
  });
});
