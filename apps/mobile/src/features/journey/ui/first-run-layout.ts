type FirstRunViewport = Readonly<{
  fontScale: number;
  height: number;
  width: number;
}>;

export type FirstRunBrandLayout = "inline-brand" | "stacked";

export type FirstRunLayout = Readonly<{
  brandLayout: FirstRunBrandLayout;
  brandPaddingTop: 0 | 20;
  screenPaddingVertical: 0 | 16 | 32;
}>;

export function resolveFirstRunLayout({ fontScale, height, width }: FirstRunViewport): FirstRunLayout {
  if (width < 350 || height < 540 || fontScale > 1.1) {
    return { brandLayout: "inline-brand", brandPaddingTop: 0, screenPaddingVertical: 0 };
  }
  if (height < 680) {
    return { brandLayout: "inline-brand", brandPaddingTop: 0, screenPaddingVertical: 16 };
  }
  return { brandLayout: "stacked", brandPaddingTop: 20, screenPaddingVertical: 32 };
}
