import {
  COMMUNICATION_SECTION_IDS,
  type CommunicationSectionId,
  type EditableDerivedField,
  type JourneyDraft
} from "./types";

export const COMMUNICATION_CARD_SECTION_IDS = COMMUNICATION_SECTION_IDS;
export const COMMUNICATION_CARD_CONSENT_FOOTER =
  "这张卡只代表我整理它时的感受。任何人都可以随时改变主意，每一种靠近仍然需要当时再次确认。";

const OPTION_LABELS: Record<string, string> = {
  "draft-expect-rest": "有更多时间待在一起",
  "draft-rest": "有更多时间待在一起",
  "draft-expect-talk": "聊一些平时没机会聊的话",
  "expect-more-closeness": "有更多拥抱、依偎或其他亲近",
  "expect-further-contact": "也许有更进一步的身体接触",
  "expect-wake-together": "醒来时还在彼此身边",
  "expect-long-time-natural": "看看长时间相处是否自然",
  "expect-not-imagined": "我还没有具体想象",
  "behavior-hug": "拥抱或依偎",
  "draft-kissing": "接吻",
  "behavior-same-bed": "睡在同一张床上",
  "behavior-my-nudity": "让对方看见我的裸露",
  "behavior-partner-nudity": "看见对方裸露",
  "behavior-over-clothes-touch": "隔着衣物触摸私密部位",
  "behavior-direct-touch": "直接触摸私密部位",
  "behavior-oral-genital-contact": "口腔与私密部位的接触",
  "draft-oral-sex": "口腔与私密部位的接触",
  "draft-penetrative-sex": "任何形式的插入",
  "comfort-ask-before-change": "每次变化前先问我",
  "comfort-initiate-next": "由我主动开始下一步",
  "comfort-slower-progression": "整体推进得慢一点",
  "comfort-gentler-touch": "动作慢一点、温和一点",
  "comfort-keep-clothing": "保留部分衣物",
  "comfort-talk-expectations": "先聊清楚彼此的想象",
  "comfort-no-pressure-after-pause": "提出暂停后不被追问或催促",
  "draft-comfort-privacy": "保留睡觉、独处或离开的空间",
  "draft-privacy": "保留睡觉、独处或离开的空间",
  "comfort-health-preparation": "先确认健康和保护准备",
  "comfort-write-myself": "由我自己写下来"
};

function readableLabels(draft: JourneyDraft, ids: string[]) {
  const customLabels = new Map(draft.customBehaviors.map(({ id, label }) => [id, label]));
  return [...ids]
    .sort()
    .map((id) => OPTION_LABELS[id] ?? customLabels.get(id) ?? "一项由我选择的内容")
    .join("、");
}

function attitudesWith(draft: JourneyDraft, ...values: Array<JourneyDraft["behaviorAttitudes"][string]>) {
  return Object.entries(draft.behaviorAttitudes)
    .filter(([, attitude]) => values.includes(attitude))
    .map(([behaviorId]) => behaviorId);
}

function listSentence(prefix: string, labels: string, empty: string) {
  return labels.length > 0 ? `${prefix}${labels}。` : empty;
}

function templates(draft: JourneyDraft): Record<CommunicationSectionId, string> {
  const practicedPhrase = draft.practice.phrase?.trim() || draft.practice.editedPhrase?.trim();
  return {
    "communication-night-expectations": listSentence(
      "我对这个夜晚的期待包括：",
      readableLabels(draft, draft.expectationIds),
      "我对这个夜晚暂时没有具体想象。"
    ),
    "communication-possible-closeness": listSentence(
      "我可能愿意的靠近包括：",
      readableLabels(draft, attitudesWith(draft, "looking-forward")),
      "我暂时没有标记特别期待的靠近。"
    ),
    "communication-decide-in-moment": listSentence(
      "这些事情我想留到当时再决定：",
      readableLabels(draft, attitudesWith(draft, "decide-in-moment", "unsure")),
      "目前没有需要留到当时再决定的事项。"
    ),
    "communication-not-this-time": listSentence(
      "这些事情这次先不要：",
      readableLabels(draft, attitudesWith(draft, "not-this-time")),
      "目前没有标记这次先不要的事项。"
    ),
    "communication-comfort": listSentence(
      "让我更安心的方式包括：",
      readableLabels(draft, draft.comfortNeedIds),
      "我还没有写下具体的安心需要。"
    ),
    "communication-changed-feelings": practicedPhrase
      ? `如果感受改变，我会这样说：${practicedPhrase}`
      : "我的感受可能改变，我可以随时暂停、调整或停止。",
    "communication-mutual-boundaries": "这些想法不是一次性同意；我们都可以随时改变主意，并在每一步再次确认。"
  };
}

export function buildCommunicationCard(draft: JourneyDraft): JourneyDraft["communicationCard"] {
  const generated = templates(draft);
  return Object.fromEntries(COMMUNICATION_CARD_SECTION_IDS.map((sectionId) => {
    const previous = draft.communicationCard[sectionId];
    const generatedText = generated[sectionId];
    const userEdited = previous?.userText !== undefined;
    const generatedChanged = previous !== undefined && previous.generatedText !== generatedText;
    return [sectionId, {
      generatedText,
      ...(userEdited ? { userText: previous.userText } : {}),
      sourceRevision: draft.sourceRevision,
      needsReview: userEdited && (previous.needsReview || generatedChanged),
      visibility: userEdited && generatedChanged ? "pending" : previous?.visibility ?? "pending"
    } satisfies EditableDerivedField];
  })) as JourneyDraft["communicationCard"];
}

export type ConfirmedCommunicationCard = {
  sections: Array<{ id: CommunicationSectionId; text: string }>;
  consentFooter: typeof COMMUNICATION_CARD_CONSENT_FOOTER;
};

export function selectConfirmedCommunicationCard(
  draft: Pick<JourneyDraft, "communicationCard">
): ConfirmedCommunicationCard {
  return {
    sections: COMMUNICATION_CARD_SECTION_IDS.flatMap((id) => {
      const field = draft.communicationCard[id];
      return field.visibility === "included"
        ? [{ id, text: field.userText ?? field.generatedText }]
        : [];
    }),
    consentFooter: COMMUNICATION_CARD_CONSENT_FOOTER
  };
}
