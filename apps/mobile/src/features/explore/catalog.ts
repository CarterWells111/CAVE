import type { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";

type SamplePage = Readonly<{
  kind: "introduction" | "content" | "end";
  title: string;
  body: string;
}>;

export type SampleJourney = Readonly<{
  id: string;
  title: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  pages: readonly [SamplePage, SamplePage, SamplePage];
}>;

const SAMPLE_ICONS = [
  "compass-outline", "leaf-outline", "water-outline",
  "flower-outline", "planet-outline", "sunny-outline",
] as const satisfies readonly SampleJourney["icon"][];

export const SAMPLE_JOURNEYS: readonly SampleJourney[] = SAMPLE_ICONS.map((icon, index) => {
  const number = String(index + 1).padStart(2, "0");
  return {
    id: `journey-${number}`,
    title: `旅程 ${number}`,
    icon,
    pages: [
      {
        kind: "introduction",
        title: "先看看这段旅程",
        body: "这是一段样板旅程，用来体验页面结构与前进、返回的方式。目前是框架预览，不是正式练习。",
      },
      {
        kind: "content",
        title: "为内容留一处空间",
        body: "这里是内容占位页，暂不包含正式内容、建议或需要填写的答案。你可以继续看看结束页，也可以随时返回。",
      },
      {
        kind: "end",
        title: "这次预览到这里",
        body: "你已看完这段样板旅程。本次预览不会保存答案，也不会生成回顾记录。返回地图后，可以自由打开任何一段旅程。",
      },
    ],
  };
});

export const FIRST_OVERNIGHT = { id: "first-overnight", title: "第一次过夜" } as const;

export function getSampleJourney(id: unknown): SampleJourney | undefined {
  return typeof id === "string" ? SAMPLE_JOURNEYS.find((journey) => journey.id === id) : undefined;
}
