import type { SyncEventDto, SyncStatus } from "@onepos/shared-types";
import { ApiError } from "@/lib/api/error";

export interface OneposBridge {
  queueSale: (event: SyncEventDto) => Promise<void>;
  getSyncStatus: () => Promise<SyncStatus>;
  onSyncStatusChange: (callback: (status: SyncStatus) => void) => () => void;
}

declare global {
  interface Window {
    onepos?: OneposBridge;
  }
}

/** True only inside the Electron shell — apps/desktop/src/preload.ts is what defines `window.onepos`. */
export function isElectron(): boolean {
  return typeof window !== "undefined" && Boolean(window.onepos);
}

/**
 * Distinguishes a genuine network/offline failure from `ApiError` (a
 * resolved HTTP response that just wasn't `ok`).
 *
 * Two shapes count as "offline":
 * - The browser's own fetch rejected outright (native `TypeError`) — the
 *   plain-web case, e.g. running apps/web directly without the proxy.
 * - `ApiError` with status 503 — in the Electron shell, `apiFetch` always
 *   calls this app's own same-origin `/api/proxy/*` route, which is always
 *   reachable, so the browser's fetch to it resolves normally even when the
 *   *backend* api is down. The proxy route (app/api/proxy/[...path]/route.ts)
 *   detects that server-side and reports it back as 503 specifically so it
 *   can be told apart here from a genuine application error.
 */
export function isNetworkFailure(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  return error instanceof ApiError && error.status === 503;
}
