import type { ExpressionCard, PracticeTurn } from "@cave/contracts";

export type CourseProgressRecord = {
  lessonId: string;
  completedAt: string;
  quizCorrect: number;
  quizTotal: number;
};

export type SavedPracticeRecord = {
  id: string;
  scenarioId: string;
  createdAt: string;
  expressionCard: ExpressionCard;
  transcript?: PracticeTurn[];
};

export type PrivacySettings = {
  liveModelAcknowledged: boolean;
  defaultSaveTranscript: false;
  showLocalJournalSaveNotice: boolean;
};

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  liveModelAcknowledged: false,
  defaultSaveTranscript: false,
  showLocalJournalSaveNotice: true,
};

export interface PrivacySettingsRepository {
  getPrivacySettings(): Promise<PrivacySettings>;
  setPrivacySettings(settings: PrivacySettings): Promise<void>;
  resetPrivacySettings(): Promise<void>;
}

export interface LocalDataRepository extends PrivacySettingsRepository {
  initialize(): Promise<void>;
  getCourseProgress(): Promise<CourseProgressRecord[]>;
  setCourseProgress(record: CourseProgressRecord): Promise<void>;
  listSavedRecords(): Promise<SavedPracticeRecord[]>;
  saveRecord(record: SavedPracticeRecord): Promise<void>;
  deleteRecord(id: string): Promise<void>;
  deleteAll(): Promise<void>;
}

export interface SecretRepository {
  getOrCreateDatabaseKey(): Promise<string>;
  getOrCreateInstallationToken(): Promise<string>;
  deleteAllSecrets(): Promise<void>;
}
