export const PREFERENCE_CARD_FIELDS = [
  { id: "interests", title: "愿意了解或尝试的方式" },
  { id: "boundaries", title: "暂时不想要的方式" },
  { id: "protection", title: "需要先谈好的保护条件" },
  { id: "pause", title: "希望怎样表达暂停" },
  { id: "aftercare", title: "结束后希望得到怎样的照顾" },
] as const;

export type PreferenceCardField = (typeof PREFERENCE_CARD_FIELDS)[number]["id"];
export type PreferenceCard = Record<PreferenceCardField, string>;

export interface PreferenceCardRepository {
  load(ownerId: string): Promise<PreferenceCard | null>;
  save(ownerId: string, card: PreferenceCard): Promise<void>;
  clearAll(): Promise<void>;
}

export function emptyPreferenceCard(): PreferenceCard {
  return { interests: "", boundaries: "", protection: "", pause: "", aftercare: "" };
}

export function normalizePreferenceCard(value: unknown): PreferenceCard {
  const source = value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
  const card = emptyPreferenceCard();
  for (const { id } of PREFERENCE_CARD_FIELDS) {
    card[id] = typeof source[id] === "string" ? source[id].trim().slice(0, 300) : "";
  }
  return card;
}

export class InMemoryPreferenceCardRepository implements PreferenceCardRepository {
  private readonly cards = new Map<string, PreferenceCard>();

  async load(ownerId: string) {
    const card = this.cards.get(ownerId);
    return card === undefined ? null : { ...card };
  }
  async save(ownerId: string, card: PreferenceCard) {
    this.cards.set(ownerId, normalizePreferenceCard(card));
  }
  async clearAll() { this.cards.clear(); }
}
