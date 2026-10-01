export type RoomRow = {
  id: string; scenario: "first-overnight" | "pause" | "adjust";
  owner_account_id: string; invitee_account_id: string | null;
  invitation_digest: string; invitation_expires_at: string; expires_at: string;
  joined_at: string | null; owner_answers_ciphertext: string | null;
  invitee_answers_ciphertext: string | null; owner_completed_at: string | null;
  invitee_completed_at: string | null; report_ciphertext: string | null;
  report_status: "waiting" | "generating" | "ready" | "paused" | "insufficient";
  generation_claim: string | null; generation_lease_until: string | null;
};

export interface RoomRepository {
  create(row: { id: string; scenario: RoomRow["scenario"]; ownerId: string; invitationDigest: string; invitationExpiresAt: string; expiresAt: string; now: string }): Promise<void>;
  get(id: string): Promise<RoomRow | null>;
  listForAccount(accountId: string, now: string, limit: number): Promise<RoomRow[]>;
  findByInvitationDigest(digest: string): Promise<RoomRow | null>;
  join(id: string, accountId: string, invitationDigest: string, now: string): Promise<boolean>;
  reissueInvitation(id: string, ownerId: string, digest: string, expiresAt: string, now: string): Promise<boolean>;
  save(id: string, accountId: string, role: "owner" | "invitee", ciphertext: string, now: string): Promise<boolean>;
  complete(id: string, accountId: string, role: "owner" | "invitee", now: string): Promise<boolean>;
  claim(id: string, claim: string, now: string, leaseUntil: string): Promise<boolean>;
  finish(id: string, claim: string, ciphertext: string, status: "ready" | "paused" | "insufficient", now: string, deadlineMs: number): Promise<boolean>;
  release(id: string, claim: string): Promise<void>;
  terminate(id: string, accountId: string): Promise<boolean>;
  cleanupExpired(now: string, limit: number): Promise<boolean>;
}

const COLUMNS = "id, scenario, owner_account_id, invitee_account_id, invitation_digest, invitation_expires_at, expires_at, joined_at, owner_answers_ciphertext, invitee_answers_ciphertext, owner_completed_at, invitee_completed_at, report_ciphertext, report_status, generation_claim, generation_lease_until";

export class D1RoomRepository implements RoomRepository {
  constructor(private readonly db: D1Database) {}
  async create(row: Parameters<RoomRepository["create"]>[0]): Promise<void> {
    await this.db.prepare("INSERT INTO rooms (id, scenario, owner_account_id, invitation_digest, invitation_expires_at, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(row.id, row.scenario, row.ownerId, row.invitationDigest, row.invitationExpiresAt, row.expiresAt, row.now).run();
  }
  async get(id: string): Promise<RoomRow | null> {
    return this.db.prepare(`SELECT ${COLUMNS} FROM rooms WHERE id = ? LIMIT 1`).bind(id).first<RoomRow>();
  }
  async listForAccount(accountId: string, now: string, limit: number): Promise<RoomRow[]> {
    const result = await this.db.prepare(`SELECT ${COLUMNS} FROM rooms
      WHERE expires_at > ? AND (owner_account_id = ? OR (invitee_account_id = ? AND joined_at IS NOT NULL))
      ORDER BY created_at DESC, id DESC LIMIT ?`).bind(now, accountId, accountId, limit).all<RoomRow>();
    return result.results;
  }
  async findByInvitationDigest(digest: string): Promise<RoomRow | null> {
    return this.db.prepare(`SELECT ${COLUMNS} FROM rooms WHERE invitation_digest = ? LIMIT 1`).bind(digest).first<RoomRow>();
  }
  async join(id: string, accountId: string, invitationDigest: string, now: string): Promise<boolean> {
    const result = await this.db.prepare(`UPDATE rooms SET invitee_account_id = ?, joined_at = ?
      WHERE id = ? AND owner_account_id <> ? AND (invitee_account_id IS NULL OR invitee_account_id = ?)
        AND joined_at IS NULL AND invitation_digest = ? AND invitation_expires_at > ? AND expires_at > ?`)
      .bind(accountId, now, id, accountId, accountId, invitationDigest, now, now).run();
    return result.meta.changes === 1;
  }
  async reissueInvitation(id: string, ownerId: string, digest: string, expiresAt: string, now: string): Promise<boolean> {
    const result = await this.db.prepare(`UPDATE rooms SET invitation_digest = ?, invitation_expires_at = ?
      WHERE id = ? AND owner_account_id = ? AND joined_at IS NULL AND expires_at > ?`)
      .bind(digest, expiresAt, id, ownerId, now).run();
    return result.meta.changes === 1;
  }
  async save(id: string, accountId: string, role: "owner" | "invitee", ciphertext: string, now: string): Promise<boolean> {
    const own = role === "owner";
    const result = await this.db.prepare(`UPDATE rooms SET ${own ? "owner_answers_ciphertext" : "invitee_answers_ciphertext"} = ?,
      ${own ? "owner_completed_at" : "invitee_completed_at"} = NULL,
      report_ciphertext = NULL, report_status = 'waiting', generation_claim = NULL, generation_lease_until = NULL
      WHERE id = ? AND ${own ? "owner_account_id" : "invitee_account_id"} = ?
        AND ${own ? "1 = 1" : "joined_at IS NOT NULL"} AND expires_at > ?`)
      .bind(ciphertext, id, accountId, now).run();
    return result.meta.changes === 1;
  }
  async complete(id: string, accountId: string, role: "owner" | "invitee", now: string): Promise<boolean> {
    const own = role === "owner";
    const result = await this.db.prepare(`UPDATE rooms SET ${own ? "owner_completed_at" : "invitee_completed_at"} = ?
      WHERE id = ? AND ${own ? "owner_account_id" : "invitee_account_id"} = ? AND ${own ? "owner_answers_ciphertext" : "invitee_answers_ciphertext"} IS NOT NULL
        AND ${own ? "1 = 1" : "joined_at IS NOT NULL"} AND expires_at > ? AND report_status = 'waiting' AND ${own ? "owner_completed_at" : "invitee_completed_at"} IS NULL`)
      .bind(now, id, accountId, now).run();
    return result.meta.changes === 1;
  }
  async claim(id: string, claim: string, now: string, leaseUntil: string): Promise<boolean> {
    const result = await this.db.prepare(`UPDATE rooms SET report_status = 'generating', generation_claim = ?, generation_lease_until = ?
      WHERE id = ? AND expires_at > ? AND joined_at IS NOT NULL AND owner_completed_at IS NOT NULL AND invitee_completed_at IS NOT NULL
        AND owner_answers_ciphertext IS NOT NULL AND invitee_answers_ciphertext IS NOT NULL
        AND (report_status = 'waiting' OR (report_status = 'generating' AND generation_lease_until < ?))`)
      .bind(claim, leaseUntil, id, now, now).run();
    return result.meta.changes === 1;
  }
  async finish(id: string, claim: string, ciphertext: string, status: "ready" | "paused" | "insufficient", now: string, deadlineMs: number): Promise<boolean> {
    const result = await this.db.prepare(`UPDATE rooms SET report_ciphertext = ?, report_status = ?, generation_claim = NULL, generation_lease_until = NULL
      WHERE id = ? AND generation_claim = ? AND report_status = 'generating' AND expires_at > ?
        AND joined_at IS NOT NULL AND owner_completed_at IS NOT NULL AND invitee_completed_at IS NOT NULL
        AND (julianday('now') - 2440587.5) * 86400000 < ?`)
      .bind(ciphertext, status, id, claim, now, deadlineMs).run();
    return result.meta.changes === 1;
  }
  async release(id: string, claim: string): Promise<void> {
    await this.db.prepare("UPDATE rooms SET report_status = 'waiting', generation_claim = NULL, generation_lease_until = NULL WHERE id = ? AND generation_claim = ? AND report_status = 'generating'").bind(id, claim).run();
  }
  async terminate(id: string, accountId: string): Promise<boolean> {
    const result = await this.db.prepare("DELETE FROM rooms WHERE id = ? AND (owner_account_id = ? OR (invitee_account_id = ? AND joined_at IS NOT NULL))")
      .bind(id, accountId, accountId).run();
    return result.meta.changes === 1;
  }
  async cleanupExpired(now: string, limit: number): Promise<boolean> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error("room-cleanup-limit-invalid");
    const result = await this.db.prepare("DELETE FROM rooms WHERE rowid IN (SELECT rowid FROM rooms WHERE expires_at <= ? LIMIT ?)").bind(now, limit).run();
    return result.meta.changes >= limit;
  }
}
