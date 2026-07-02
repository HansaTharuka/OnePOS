"use client";

import { useEffect, useState } from "react";
import type { SyncStatus } from "@onepos/shared-types";
import { isElectron } from "./electron-bridge";

const ONLINE_NOOP: SyncStatus = { online: true, pendingCount: 0, erroredCount: 0 };

/**
 * Subscribes to the Electron main process's sync-status broadcasts. Outside
 * Electron (a plain browser tab — a supported fallback per
 * docs/01-architecture-overview.md §4) this always reports "online, nothing
 * pending" so callers can render it unconditionally.
 */
export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(ONLINE_NOOP);

  useEffect(() => {
    if (!isElectron()) return;

    window.onepos!.getSyncStatus().then(setStatus).catch(() => {});
    const unsubscribe = window.onepos!.onSyncStatusChange(setStatus);
    return unsubscribe;
  }, []);

  return status;
}
