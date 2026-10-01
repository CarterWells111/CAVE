import type { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";

type SamplePage = Readonly<{
  kind: "introduction" | "content" | "end";
  title: string;
  body: string;
  showVulvaDiagram?: boolean;
}>;

export type SampleJourney = Readonly<{
  id: string;
  title: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  preview: boolean;
  pages: readonly [SamplePage, SamplePage, SamplePage];
}>;

const SAMPLE_ICONS = [
  "compass-outline", "leaf-outline", "water-outline",
  "flower-outline", "planet-outline", "sunny-outline",
] as const satisfies readonly SampleJourney["icon"][];

const BODY_JOURNEY: SampleJourney = {
  id: "journey-01",
  title: "旅程 01",
  icon: SAMPLE_ICONS[0],
  preview: false,
  pages: [
    {
      kind: "introduction",
      title: "外阴、阴道在哪里？",
      body: "外面看得见的生殖器区域叫外阴。阴道在体内，开口是阴道口。外阴上还可以看到阴唇、阴蒂和尿道口。",
      showVulvaDiagram: true,
    },
    {
      kind: "content",
      title: "每个人的样子都不同",
      body: "阴唇的长短、颜色和左右形状可以不同；乳房的大小和形状也因人而异。示意图用来认位置，不代表每个人都长这样。如果有持续疼痛、瘙痒或明显的新变化，可以咨询医护人员。",
    },
    {
      kind: "end",
      title: "身体反应与我的选择",
      body: "听到情话，或在拥抱、爱抚、亲吻等身体接触时，身体可能变得敏感，阴道口附近可能有分泌物、感觉湿润；也可能没有明显反应。阴道分泌物平时也会出现。这些只是你身体的反应，而你心里可能是舒服、好奇、犹豫或不适。身体反应不能替你决定是否愿意，这个决定也可以改变。",
    },
  ],
};

export const SAMPLE_JOURNEYS: readonly SampleJourney[] = [BODY_JOURNEY, ...SAMPLE_ICONS.slice(1).map((icon, index): SampleJourney => {
  const number = String(index + 2).padStart(2, "0");
  return {
    id: `journey-${number}`,
    title: `旅程 ${number}`,
    icon,
    preview: true,
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
})];

export const FIRST_OVERNIGHT = { id: "first-overnight", title: "第一次过夜" } as const;

export function getSampleJourney(id: unknown): SampleJourney | undefined {
  return typeof id === "string" ? SAMPLE_JOURNEYS.find((journey) => journey.id === id) : undefined;
}
