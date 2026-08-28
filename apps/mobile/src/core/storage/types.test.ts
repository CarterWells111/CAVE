import type { ExpressionCard, PracticeTurn } from "@cave/contracts";

import type {
  CourseProgressRecord,
  LocalDataRepository,
  PrivacySettings,
  SavedPracticeRecord
} from "./types";

class InMemoryLocalDataRepository implements LocalDataRepository {
  private progress = new Map<string, CourseProgressRecord>();
  private records = new Map<string, SavedPracticeRecord>();
  private privacy: PrivacySettings = {
    liveModelAcknowledged: false,
    defaultSaveTranscript: false,
    showLocalJournalSaveNotice: true,
  };

  async initialize() { return undefined; }
  async getCourseProgress() { return [...this.progress.values()]; }
  async setCourseProgress(record: CourseProgressRecord) { this.progress.set(record.lessonId, record); }
  async listSavedRecords() { return [...this.records.values()]; }
  async saveRecord(record: SavedPracticeRecord) { this.records.set(record.id, record); }
  async deleteRecord(id: string) { this.records.delete(id); }
  async getPrivacySettings() { return this.privacy; }
  async setPrivacySettings(settings: PrivacySettings) { this.privacy = settings; }
  async resetPrivacySettings() {
    this.privacy = { liveModelAcknowledged: false, defaultSaveTranscript: false, showLocalJournalSaveNotice: true };
  }
  async deleteAll() {
    this.progress.clear();
    this.records.clear();
    await this.resetPrivacySettings();
  }
}

const expressionCard: ExpressionCard = { boundary: "我需要停下来" };
const transcript: PracticeTurn[] = [{ role: "user", text: "仅在本次明确保存" }];

describe("LocalDataRepository contract", () => {
  test("covers initialize, progress, saved records, privacy, and delete all", async () => {
    const repository: LocalDataRepository = new InMemoryLocalDataRepository();
    const progress: CourseProgressRecord = {
      lessonId: "lesson-boundaries",
      completedAt: "2026-08-27T10:00:00.000Z",
      quizCorrect: 3,
      quizTotal: 4
    };
    const saved: SavedPracticeRecord = {
      id: "saved-1",
      scenarioId: "scenario-boundary",
      createdAt: "2026-08-27T10:01:00.000Z",
      expressionCard
    };

    await repository.initialize();
    await repository.setCourseProgress(progress);
    await repository.saveRecord(saved);
    expect(await repository.getCourseProgress()).toEqual([progress]);
    expect(await repository.listSavedRecords()).toEqual([saved]);
    expect((await repository.listSavedRecords())[0]).not.toHaveProperty("transcript");

    await repository.saveRecord({ ...saved, id: "saved-2", transcript });
    expect((await repository.listSavedRecords())[1]?.transcript).toEqual(transcript);

    await repository.deleteRecord("saved-1");
    expect((await repository.listSavedRecords()).map((record) => record.id)).toEqual(["saved-2"]);

    const settings: PrivacySettings = {
      liveModelAcknowledged: true,
      defaultSaveTranscript: false,
      showLocalJournalSaveNotice: false,
    };
    await repository.setPrivacySettings(settings);
    expect(await repository.getPrivacySettings()).toEqual(settings);

    await repository.deleteAll();
    expect(await repository.getCourseProgress()).toEqual([]);
    expect(await repository.listSavedRecords()).toEqual([]);
    expect(await repository.getPrivacySettings()).toEqual({
      liveModelAcknowledged: false,
      defaultSaveTranscript: false,
      showLocalJournalSaveNotice: true,
    });
  });
});
