import type {
  DatabaseTransactionConnection,
  TransactionalEncryptedDatabaseManager
} from "./database";
import type {
  CourseProgressRecord,
  LocalDataRepository,
  PrivacySettings,
  SavedPracticeRecord
} from "./types";
import { DEFAULT_PRIVACY_SETTINGS } from "./types";

type ProgressRow = {
  lesson_id: string;
  completed_at: string;
  quiz_correct: number;
  quiz_total: number;
};

type SavedRow = {
  id: string;
  scenario_id: string;
  created_at: string;
  expression_card: string;
  transcript: string | null;
};

type PrivacyRow = {
  live_model_acknowledged: number;
  default_save_transcript: number;
};

type LocalJournalPreferenceRow = {
  show_save_notice: number;
};

type LegacyJournalPreferenceRow = {
  show_local_journal_save_notice: number;
};

type TableInfoRow = {
  name: string;
};

export class SqlLocalDataRepository implements LocalDataRepository {
  constructor(private readonly database: TransactionalEncryptedDatabaseManager) {}

  async initialize() { await this.database.initialize(); }

  async getCourseProgress(): Promise<CourseProgressRecord[]> {
    const connection = await this.database.initialize();
    const rows = await connection.getAllAsync<ProgressRow>(
      "SELECT lesson_id, completed_at, quiz_correct, quiz_total FROM course_progress ORDER BY completed_at"
    );
    return rows.map((row) => ({
      lessonId: row.lesson_id,
      completedAt: row.completed_at,
      quizCorrect: row.quiz_correct,
      quizTotal: row.quiz_total
    }));
  }

  async setCourseProgress(record: CourseProgressRecord): Promise<void> {
    const connection = await this.database.initialize();
    await connection.runAsync(
      "INSERT INTO course_progress (lesson_id, completed_at, quiz_correct, quiz_total) VALUES (?, ?, ?, ?) ON CONFLICT(lesson_id) DO UPDATE SET completed_at = excluded.completed_at, quiz_correct = excluded.quiz_correct, quiz_total = excluded.quiz_total",
      record.lessonId,
      record.completedAt,
      record.quizCorrect,
      record.quizTotal
    );
  }

  async listSavedRecords(): Promise<SavedPracticeRecord[]> {
    const connection = await this.database.initialize();
    const rows = await connection.getAllAsync<SavedRow>(
      "SELECT id, scenario_id, created_at, expression_card, transcript FROM saved_records ORDER BY created_at DESC"
    );
    return rows.map((row) => {
      const record: SavedPracticeRecord = {
        id: row.id,
        scenarioId: row.scenario_id,
        createdAt: row.created_at,
        expressionCard: JSON.parse(row.expression_card) as SavedPracticeRecord["expressionCard"]
      };
      if (row.transcript !== null) {
        record.transcript = JSON.parse(row.transcript) as NonNullable<SavedPracticeRecord["transcript"]>;
      }
      return record;
    });
  }

  async saveRecord(record: SavedPracticeRecord): Promise<void> {
    const connection = await this.database.initialize();
    await connection.runAsync(
      "INSERT INTO saved_records (id, scenario_id, created_at, expression_card, transcript) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET scenario_id = excluded.scenario_id, created_at = excluded.created_at, expression_card = excluded.expression_card, transcript = excluded.transcript",
      record.id,
      record.scenarioId,
      record.createdAt,
      JSON.stringify(record.expressionCard),
      record.transcript === undefined ? null : JSON.stringify(record.transcript)
    );
  }

  async deleteRecord(id: string): Promise<void> {
    const connection = await this.database.initialize();
    await connection.runAsync("DELETE FROM saved_records WHERE id = ?", id);
  }

  async getPrivacySettings(): Promise<PrivacySettings> {
    const connection = await this.database.initialize();
    const row = await connection.getFirstAsync<PrivacyRow>(
      "SELECT live_model_acknowledged, default_save_transcript FROM privacy_settings WHERE singleton_id = ?",
      1
    );
    const localJournalPreference = await connection.getFirstAsync<LocalJournalPreferenceRow>(
      "SELECT show_save_notice FROM local_journal_preferences WHERE singleton_id = ?",
      1
    );
    let showLocalJournalSaveNotice = localJournalPreference?.show_save_notice === 1;
    if (localJournalPreference === null) {
      const columns = await connection.getAllAsync<TableInfoRow>(
        "PRAGMA table_info(privacy_settings)"
      );
      if (columns.some(({ name }) => name === "show_local_journal_save_notice")) {
        const legacy = await connection.getFirstAsync<LegacyJournalPreferenceRow>(
          "SELECT show_local_journal_save_notice FROM privacy_settings WHERE singleton_id = ?",
          1
        );
        showLocalJournalSaveNotice = legacy?.show_local_journal_save_notice !== 0;
      } else {
        showLocalJournalSaveNotice = DEFAULT_PRIVACY_SETTINGS.showLocalJournalSaveNotice;
      }
    }
    if (row === null) {
      return { ...DEFAULT_PRIVACY_SETTINGS, showLocalJournalSaveNotice };
    }
    return {
      liveModelAcknowledged: row.live_model_acknowledged === 1,
      defaultSaveTranscript: false,
      showLocalJournalSaveNotice,
    };
  }

  async setPrivacySettings(settings: PrivacySettings): Promise<void> {
    await this.database.withTransaction(async (connection) => {
      await this.writePrivacySettings(connection, settings);
    });
  }

  private async writePrivacySettings(
    connection: DatabaseTransactionConnection,
    settings: PrivacySettings
  ): Promise<void> {
    await connection.runAsync(
      "INSERT INTO privacy_settings (singleton_id, live_model_acknowledged, default_save_transcript) VALUES (?, ?, ?) ON CONFLICT(singleton_id) DO UPDATE SET live_model_acknowledged = excluded.live_model_acknowledged, default_save_transcript = excluded.default_save_transcript",
      1,
      settings.liveModelAcknowledged ? 1 : 0,
      0
    );
    await connection.runAsync(
      "INSERT INTO local_journal_preferences (singleton_id, show_save_notice) VALUES (?, ?) ON CONFLICT(singleton_id) DO UPDATE SET show_save_notice = excluded.show_save_notice",
      1,
      settings.showLocalJournalSaveNotice ? 1 : 0,
    );
  }

  async resetPrivacySettings(): Promise<void> {
    await this.database.withTransaction(async (connection) => {
      await connection.runAsync("DELETE FROM privacy_settings");
      await connection.runAsync("DELETE FROM local_journal_preferences");
    });
  }

  async deleteAll(): Promise<void> {
    await this.database.withTransaction(async (connection) => {
      await connection.runAsync("DELETE FROM course_progress");
      await connection.runAsync("DELETE FROM saved_records");
      await connection.runAsync("DELETE FROM privacy_settings");
      await connection.runAsync("DELETE FROM local_journal_preferences");
    });
  }
}
