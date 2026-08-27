import type {
  JourneyDraft,
  SavedCommunicationCardMetadata,
  SavedCommunicationCardRecord
} from "../domain/types";
import type {
  CommunicationCardRepository,
  JourneyDraftRepository
} from "./journey-draft-repository";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class InMemoryJourneyDraftRepository implements JourneyDraftRepository {
  private active: JourneyDraft | null = null;

  async loadActive(): Promise<JourneyDraft | null> {
    return this.active === null ? null : clone(this.active);
  }

  async saveActive(draft: JourneyDraft): Promise<void> {
    this.active = clone(draft);
  }

  async deleteActive(): Promise<void> {
    this.active = null;
  }
}

export class InMemoryCommunicationCardRepository implements CommunicationCardRepository {
  private readonly records = new Map<string, SavedCommunicationCardRecord>();

  async list(): Promise<SavedCommunicationCardRecord[]> {
    return [...this.records.values()]
      .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
      .map(clone);
  }

  async listMetadata(): Promise<SavedCommunicationCardMetadata[]> {
    return [...this.records.values()]
      .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
      .map(({ id, journeyId, savedAt }) => ({ id, journeyId, savedAt }));
  }

  async load(id: string): Promise<SavedCommunicationCardRecord | null> {
    const record = this.records.get(id);
    return record === undefined ? null : clone(record);
  }

  async save(record: SavedCommunicationCardRecord): Promise<void> {
    this.records.set(record.id, clone(record));
  }

  async delete(id: string): Promise<void> {
    this.records.delete(id);
  }
}
