import { contextBridge, ipcRenderer } from "electron";
import type { SyncEventDto, SyncStatus } from "@onepos/shared-types";

export interface StartupStepEvent {
  step: "database" | "server" | "web";
  status: "active" | "done" | "error";
  detail?: string;
}

/**
 * The only surface the renderer (the ordinary Next.js POS app, unaware it's
 * running inside Electron unless it checks for `window.onepos`) gets into
 * the main process — see apps/web/src/lib/offline/electron-bridge.ts for the
 * matching renderer-side type declaration.
 */
const onepos = {
  queueSale: (event: SyncEventDto): Promise<void> => ipcRenderer.invoke("sync:queue-sale", event),
  getSyncStatus: (): Promise<SyncStatus> => ipcRenderer.invoke("sync:get-status"),
  onSyncStatusChange: (callback: (status: SyncStatus) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: SyncStatus) => callback(status);
    ipcRenderer.on("sync:status-changed", listener);
    return () => ipcRenderer.removeListener("sync:status-changed", listener);
  },
  /** Splash screen only (src/splash.html) — checklist progress while Mongo/api/web start up. */
  onStartupStep: (callback: (event: StartupStepEvent) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: StartupStepEvent) => callback(payload);
    ipcRenderer.on("startup:step", listener);
    return () => ipcRenderer.removeListener("startup:step", listener);
  },
};

contextBridge.exposeInMainWorld("onepos", onepos);

export type OneposBridge = typeof onepos;
