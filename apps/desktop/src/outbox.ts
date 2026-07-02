import Database from "better-sqlite3";
import { app } from "electron";
import path from "node:path";
import type { SyncEventDto } from "@onepos/shared-types";

export interface OutboxRow {
  clientEventId: string;
  payload: SyncEventDto;
  status: "pending" | "error";
  lastError?: string;
  createdAt: string;
}

interface OutboxRowRaw {
  client_event_id: string;
  payload: string;
  status: "pending" | "error";
  last_error: string | null;
  created_at: string;
}

/**
 * The terminal's local write-ahead store for sales rung up while the API is
 * unreachable (docs/05-offline-sync-and-backup.md). `client_event_id` is
 * unique so a duplicate `enqueue()` call (e.g. a renderer retry) is a no-op
 * rather than a second queued copy of the same sale.
 */
export class Outbox {
  private readonly db: Database.Database;

  constructor(dbPath: string = path.join(app.getPath("userData"), "outbox.sqlite3")) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS outbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_event_id TEXT NOT NULL UNIQUE,
        payload TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending','error')) DEFAULT 'pending',
        last_error TEXT,
        created_at TEXT NOT NULL
      )
    `);
  }

  enqueue(event: SyncEventDto): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO outbox (client_event_id, payload, status, created_at)
         VALUES (?, ?, 'pending', ?)`,
      )
      .run(event.clientEventId, JSON.stringify(event), new Date().toISOString());
  }

  listPending(): OutboxRow[] {
    const rows = this.db
      .prepare(
        `SELECT client_event_id, payload, status, last_error, created_at
         FROM outbox WHERE status = 'pending' ORDER BY id ASC`,
      )
      .all() as OutboxRowRaw[];
    return rows.map(toOutboxRow);
  }

  /** Stops retrying a row — the same business-rule rejection would recur forever otherwise. */
  markError(clientEventId: string, reason: string): void {
    this.db
      .prepare(`UPDATE outbox SET status = 'error', last_error = ? WHERE client_event_id = ?`)
      .run(reason, clientEventId);
  }

  remove(clientEventId: string): void {
    this.db.prepare(`DELETE FROM outbox WHERE client_event_id = ?`).run(clientEventId);
  }

  countPending(): number {
    return this.count("pending");
  }

  countErrored(): number {
    return this.count("error");
  }

  private count(status: "pending" | "error"): number {
    const row = this.db
      .prepare(`SELECT COUNT(*) as count FROM outbox WHERE status = ?`)
      .get(status) as { count: number };
    return row.count;
  }
}

function toOutboxRow(row: OutboxRowRaw): OutboxRow {
  return {
    clientEventId: row.client_event_id,
    payload: JSON.parse(row.payload) as SyncEventDto,
    status: row.status,
    lastError: row.last_error ?? undefined,
    createdAt: row.created_at,
  };
}
