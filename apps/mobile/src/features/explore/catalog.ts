import type { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { LATER_JOURNEYS } from "./later-journeys";

export type SamplePage = Readonly<{
  kind: "introduction" | "content" | "end";
  title: string;
  body: string;
  showVulvaDiagram?: boolean;
  cards?: readonly Readonly<{ title: string; body: string; tag?: "可选" | "展开补充"; source?: Readonly<{ label: string; url: string }> }>[];
  footer?: string;
  preferenceCard?: boolean;
  article?: Readonly<{
    title: string;
    organization: string;
    summary: string;
    url: string;
  }>;
  webLink?: Readonly<{ label: string; url: string }>;
}>;

export type SampleJourney = Readonly<{
  id: string;
  title: string;
  subtitle?: string;
  statusLabel?: string;
  helpText?: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  preview: boolean;
  pages: readonly [SamplePage, SamplePage, SamplePage];
}>;

const SAMPLE_ICONS = [
  "compass-outline", "leaf-outline", "water-outline",
  "flower-outline", "planet-outline", "sunny-outline",
] as const satisfies readonly SampleJourney["icon"][];

const BODY_RESPONSE_URL = process.env.NODE_ENV !== "production"
  ? process.env.EXPO_PUBLIC_BODY_RESPONSE_PREVIEW_URL || "https://neijiecave.com/body-response/"
  : "https://neijiecave.com/body-response/";

const VULVOVAGINAL_HEALTH_URL = process.env.NODE_ENV !== "production"
  ? process.env.EXPO_PUBLIC_VULVOVAGINAL_HEALTH_PREVIEW_URL || "https://neijiecave.com/vulvovaginal-health/"
  : "https://neijiecave.com/vulvovaginal-health/";

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
      article: {
        title: "外阴与阴道健康",
        organization: "美国妇产科医师学会（ACOG）",
        summary: "这篇医学问答介绍外阴外观的常见差异：阴唇可能长短不同、两侧不完全对称，颜色也因人而异。比起拿示意图寻找统一标准，更重要的是留意自己持续的不适或明显的新变化。",
        url: VULVOVAGINAL_HEALTH_URL,
      },
    },
    {
      kind: "end",
      title: "身体反应与我的选择",
      body: "听到情话，或在拥抱、爱抚、亲吻等身体接触时，身体可能变得敏感，阴道口附近可能有分泌物、感觉湿润；也可能没有明显反应。阴道分泌物平时也会出现。这些只是你身体的反应，而你心里可能是舒服、好奇、犹豫或不适。身体反应不能替你决定是否愿意，这个决定也可以改变。",
      webLink: {
        label: "阅读中文译述：身体反应与我的选择",
        url: BODY_RESPONSE_URL,
      },
    },
  ],
};

const PLEASURE_JOURNEY: SampleJourney = {
  id: "journey-02",
  title: "旅程 02",
  subtitle: "认识愉悦的方式",
  statusLabel: "亲密方式 · 待专业复核",
  helpText: "自由点开想看的知识卡。阅读即可，无需尝试；任何时候都可以返回地图。",
  icon: SAMPLE_ICONS[1],
  preview: false,
  pages: [
    {
      kind: "introduction",
      title: "亲密没有固定顺序",
      body: "亲密可以是亲吻、拥抱和触碰，也可以包括其他身体接触。没有哪一种方式更“完整”，也不需要按顺序尝试。同一种接触，有人喜欢，有人无感，也有人不舒服；自己的感受也可能改变。接下来可以自由查看知识卡，只需了解，不要求尝试。",
    },
    {
      kind: "content",
      title: "认识不同的亲密方式",
      body: "这些方式并列呈现。可以自由点开感兴趣的卡片，不必读完每一张才能继续。",
      cards: [
        {
          title: "亲吻与身体触碰",
          body: "拥抱、亲吻、抚摸或身体贴近，都可以单独成为亲密方式，不需要通向阴道纳入。有人喜欢其中一些接触，也有人此刻不想被碰。先问对方愿意怎样接触、哪些部位不想被碰。乳房和外阴的具体触碰留在各自的卡片里说明。",
          source: { label: "来源：ACOG 亲密与性健康资料", url: "https://www.acog.org/womens-health/faqs/your-sexual-health" },
        },
        {
          title: "乳房刺激",
          body: "乳房或乳头的触碰，对不同人的感受差异很大，可能舒服、无感或疼痛。触碰前先确认对方是否愿意，以及喜欢怎样的接触。任何时候都可以停下，不需要说明理由。",
        },
        {
          title: "手指触碰外阴",
          body: "用手指触碰外阴，例如阴唇、阴蒂及其周围。不同部位的感受可能不同，也可能没有愉悦感。先确认对方是否愿意、哪些部位可以触碰。接触前保持手部清洁。无论是疼痛、不适、犹豫，还是只是想停，都可以随时停止，不需要说明理由。",
          source: { label: "来源：NHS 手部接触与卫生资料", url: "https://www.sexualhealthsthelens.nhs.uk/adult-hands" },
        },
        {
          title: "口交",
          body: "用口唇或舌头接触伴侣的生殖器。有人喜欢，也有人不想要这种接触。先确认双方是否愿意。口交也可能传播性传播感染；屏障方法可以降低风险。",
          source: { label: "来源：CDC 口交与感染风险资料", url: "https://www.cdc.gov/sti/about/about-sti-risk-and-oral-sex.html" },
        },
        {
          title: "阴道纳入",
          body: "手指、阴茎或适用的性玩具进入阴道，与触碰外阴是不同的选择。先确认是否愿意。阴茎进入阴道时，需要考虑怀孕和性传播感染风险；频繁或严重疼痛值得咨询医护人员。",
          source: { label: "来源：ACOG 亲密方式与健康资料", url: "https://www.acog.org/womens-health/faqs/you-and-your-sexuality" },
        },
        {
          title: "独自探索",
          tag: "可选",
          body: "独自触碰自己的身体，了解喜欢、不喜欢或没有感觉的部分；也可以完全不做。没有必须达到的结果。接触前保持手和用品清洁。",
          source: { label: "来源：NHS 亲密关系与独自探索资料", url: "https://www.devonsexualhealth.nhs.uk/your-sexual-health/relationships-and-intimacy/" },
        },
        {
          title: "肛门纳入",
          tag: "展开补充",
          body: "手指、阴茎或适用用品进入肛门。它不是其他方式之后的“下一步”。这类接触可能造成微小损伤，也有性传播感染风险；具体保护事项在旅程 04 展开。",
          source: { label: "来源：ACOG 亲密方式与健康资料", url: "https://www.acog.org/womens-health/faqs/you-and-your-sexuality" },
        },
      ],
      footer: "任何时候、出于任何原因，都可以暂停或停止。",
    },
    {
      kind: "end",
      title: "选择可以留给自己",
      body: "了解一种方式，不等于必须尝试；喜欢一种方式，也不等于同意其他方式。可以说出自己的想法，也可以犹豫或改变主意。任何时候、出于任何原因，都可以暂停或停止。下一段旅程再练习如何发出邀请、回应犹豫与拒绝。",
    },
  ],
};

export const SAMPLE_JOURNEYS: readonly SampleJourney[] = [BODY_JOURNEY, PLEASURE_JOURNEY, ...LATER_JOURNEYS];

export const FIRST_OVERNIGHT = { id: "first-overnight", title: "第一次过夜" } as const;

export function getSampleJourney(id: unknown): SampleJourney | undefined {
  return typeof id === "string" ? SAMPLE_JOURNEYS.find((journey) => journey.id === id) : undefined;
}
