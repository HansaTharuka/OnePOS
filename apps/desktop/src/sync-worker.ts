import type { BrowserWindow, Session } from "electron";
import type {
  SyncEventDto,
  SyncPushRequestDto,
  SyncPushResponseDto,
  SyncStatus,
} from "@onepos/shared-types";
import type { Outbox } from "./outbox";

const SESSION_COOKIE_NAME = "onepos_session";
const SYNC_INTERVAL_MS = 15_000;
const MAX_EVENTS_PER_PUSH = 25;

interface StoredSession {
  accessToken: string;
}

/**
 * Background loop that flushes the local outbox to the API once connectivity
 * returns. Reads the `onepos_session` cookie straight from the same Electron
 * session the renderer's login already populated (BFF pattern — see
 * apps/web/src/lib/session.ts) so replayed sales are attributed to whichever
 * cashier actually rang them up while offline, without a second auth flow in
 * the main process.
 */
export class SyncWorker {
  private timer?: ReturnType<typeof setInterval>;
  private lastError: string | undefined;

  constructor(
    private readonly outbox: Outbox,
    private readonly electronSession: Session,
    private readonly apiBaseUrl: string,
    private readonly getWindow: () => BrowserWindow | undefined,
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, SYNC_INTERVAL_MS);
    void this.tick();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private async getAccessToken(): Promise<string | undefined> {
    const cookies = await this.electronSession.cookies.get({ name: SESSION_COOKIE_NAME });
    const raw = cookies[0]?.value;
    if (!raw) return undefined;
    try {
      const decoded = decodeURIComponent(raw);
      const parsed = JSON.parse(decoded) as StoredSession;
      return parsed.accessToken;
    } catch {
      return undefined;
    }
  }

  private async checkReachable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.apiBaseUrl}/api/settings/public`, {
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private async tick(): Promise<void> {
    const pending = this.outbox.listPending();
    const online = await this.checkReachable();

    if (online && pending.length > 0) {
      const accessToken = await this.getAccessToken();
      if (accessToken) {
        await this.pushBatch(pending.slice(0, MAX_EVENTS_PER_PUSH), accessToken);
      }
    }

    this.emitStatus(online);
  }

  private async pushBatch(
    rows: { clientEventId: string; payload: SyncEventDto }[],
    accessToken: string,
  ): Promise<void> {
    const body: SyncPushRequestDto = { events: rows.map((r) => r.payload) };
    try {
      const res = await fetch(`${this.apiBaseUrl}/api/sync/push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        this.lastError = `Sync push failed with HTTP ${res.status}`;
        return;
      }
      const { results } = (await res.json()) as SyncPushResponseDto;
      for (const result of results) {
        if (result.status === "applied" || result.status === "duplicate" || result.status === "flagged") {
          this.outbox.remove(result.clientEventId);
        } else if (result.status === "failed") {
          this.outbox.markError(result.clientEventId, result.reason ?? "Unknown rejection");
        }
      }
      this.lastError = undefined;
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : "Unknown sync error";
    }
  }

  private emitStatus(online: boolean): void {
    const status: SyncStatus = {
      online,
      pendingCount: this.outbox.countPending(),
      erroredCount: this.outbox.countErrored(),
      lastError: this.lastError,
    };
    this.getWindow()?.webContents.send("sync:status-changed", status);
  }
}
