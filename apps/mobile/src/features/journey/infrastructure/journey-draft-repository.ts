import type {
  JourneyDraft,
  SavedCommunicationCardMetadata,
  SavedCommunicationCardRecord
} from "../domain/types";

export interface JourneyDraftRepository {
  loadActive(): Promise<JourneyDraft | null>;
  saveActive(draft: JourneyDraft): Promise<void>;
  deleteActive(): Promise<void>;
}

export interface CommunicationCardRepository {
  list(): Promise<SavedCommunicationCardRecord[]>;
  listMetadata(): Promise<SavedCommunicationCardMetadata[]>;
  load(id: string): Promise<SavedCommunicationCardRecord | null>;
  save(record: SavedCommunicationCardRecord): Promise<void>;
  delete(id: string): Promise<void>;
}

export class JourneyStorageError extends Error {
  constructor(readonly code: "unsupported-schema" | "malformed-payload") {
    super(code);
    this.name = "JourneyStorageError";
  }
}
