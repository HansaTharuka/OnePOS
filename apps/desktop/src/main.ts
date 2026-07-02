import { app, BrowserWindow, ipcMain } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { SyncEventDto, SyncStatus } from "@onepos/shared-types";
import { Outbox } from "./outbox";
import { SyncWorker } from "./sync-worker";
import { AppConfig } from "./app-config";
import { MongoManager } from "./mongo-manager";

/**
 * Electron shell entry point (Phase 4 — offline-first, docs/05-offline-sync-and-backup.md;
 * Phase 5 — installable packaging, docs/dev-playbook/phase5.txt).
 *
 * Two run modes, branched on `app.isPackaged`:
 * - Dev (`npm run dev`): spawns apps/api and apps/web from source using the
 *   system-installed node/npm, against the dev machine's Docker MongoDB
 *   (`onepos-mongo`) — apps/api reads its own `apps/api/.env` for this, so no
 *   env vars are overridden here. Unchanged from Phase 4.
 * - Packaged (installed .exe): spawns apps/api and apps/web using a bundled
 *   portable Node runtime, against a bundled MongoMemoryServer instance whose
 *   data lives under this app's userData dir — no Docker, no system Node, no
 *   internet access required after install. Secrets are generated once on
 *   first launch (see app-config.ts) and passed as `env`, never written to a
 *   `.env` file under Program Files.
 */

const PACKAGED = app.isPackaged;

const WEB_PORT = Number(process.env.ONEPOS_WEB_PORT ?? 3000);
const API_PORT = Number(process.env.ONEPOS_API_PORT ?? 3001);
const WEB_URL = `http://localhost:${WEB_PORT}`;
const API_URL = `http://localhost:${API_PORT}`;
const HEALTH_POLL_INTERVAL_MS = 1000;
const HEALTH_POLL_TIMEOUT_MS = 60_000;
const MONGO_BINARY_VERSION = "7.0.14";
// A fresh install's resource files (node_modules, mongod/node binaries) are
// being touched for the very first time on first launch, which on Windows
// can trigger a one-off AV real-time-scan delay/read-failure on whichever
// file gets accessed at exactly the wrong moment — observed repeatedly
// during this app's own build process (see scripts/fetch-node.js). A quick
// early crash right after launch is far more likely to be that than a real
// deterministic bug, so each stage gets a few retries before giving up.
const STARTUP_RETRY_ATTEMPTS = 3;
const STARTUP_RETRY_DELAY_MS = 2000;

// Dev mode: monorepo apps/ directory. Packaged mode: electron-builder's
// extraResources land under process.resourcesPath — see electron-builder.yml.
const APPS_ROOT = PACKAGED ? process.resourcesPath : path.join(__dirname, "..", "..");
const NODE_BIN = PACKAGED
  ? path.join(process.resourcesPath, "node", process.platform === "win32" ? "node.exe" : "node")
  : "node";

let apiProcess: ChildProcess | undefined;
let webProcess: ChildProcess | undefined;
let mainWindow: BrowserWindow | undefined;
let outbox: Outbox | undefined;
let syncWorker: SyncWorker | undefined;
let mongoManager: MongoManager | undefined;

/**
 * A packaged app launched by double-click has no attached console, so
 * `stdio: "inherit"` sends api/web's output nowhere anyone can see —
 * including us, when diagnosing a report from a real install. Every launch
 * overwrites `<userData>/startup.log` with this run's full api/web output
 * plus our own step-by-step diagnostics, so "what actually happened" is
 * always on disk, not just whatever fit on the splash screen.
 */
const LOG_PATH = path.join(app.getPath("userData"), "startup.log");
fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
const logStream = fs.createWriteStream(LOG_PATH, { flags: "w" });

function log(line: string): void {
  const stamped = `[${new Date().toISOString()}] ${line}`;
  console.log(stamped);
  logStream.write(stamped + "\n");
}

function spawnChild(
  command: string,
  args: string[],
  cwd: string,
  env?: NodeJS.ProcessEnv,
): ChildProcess {
  const label = `${command} ${args.join(" ")}`;
  log(`Spawning: ${label} (cwd=${cwd})`);
  // No shell: both api and web are spawned as a direct node.exe/node path now
  // (see startApiProcess/startWebProcess) and don't need one — and on
  // Windows, shell:true wraps the child in a cmd.exe process tree where
  // child.kill() only terminates the cmd.exe wrapper, orphaning the real
  // node.exe process (and whatever port it's still holding) underneath.
  // spawnHealthyWithRetry's kill-and-respawn-on-failure depends on this
  // actually working.
  const child = spawn(command, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: env ? { ...process.env, ...env } : process.env,
  });
  child.stdout?.on("data", (chunk: Buffer) => {
    process.stdout.write(chunk);
    logStream.write(chunk);
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    process.stderr.write(chunk);
    logStream.write(chunk);
  });
  child.on("exit", (code) => {
    log(`Child process "${label}" exited with code ${code}`);
  });
  return child;
}

/**
 * Polls `url` until it responds OK. If `watchProcess` exits before that
 * happens, fails immediately with its exit code instead of waiting out the
 * full timeout doing nothing useful — a crashed api/web process otherwise
 * left the splash screen stuck on a generic "waiting" message forever.
 */
async function waitForHealth(url: string, watchProcess?: ChildProcess): Promise<void> {
  let crashMessage: string | undefined;
  const onExit = (code: number | null) => {
    crashMessage = `Process exited unexpectedly (code ${code ?? "unknown"}) before it became ready.`;
  };
  watchProcess?.once("exit", onExit);

  try {
    const deadline = Date.now() + HEALTH_POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (crashMessage) throw new Error(crashMessage);
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
        if (res.ok) return;
      } catch {
        // Not up yet — keep polling.
      }
      await new Promise((resolve) => setTimeout(resolve, HEALTH_POLL_INTERVAL_MS));
    }
    throw new Error(`Timed out waiting for ${url} to become healthy.`);
  } finally {
    watchProcess?.removeListener("exit", onExit);
  }
}

async function startMongo(): Promise<string> {
  const manager = new MongoManager({
    dbPath: path.join(app.getPath("userData"), "mongodb-data"),
    binaryDownloadDir: path.join(process.resourcesPath, "mongodb-binaries"),
    binaryVersion: MONGO_BINARY_VERSION,
  });
  mongoManager = manager;
  try {
    const uri = await manager.start();
    log(`Mongo started: ${uri}`);
    return uri;
  } catch (err) {
    log(`Mongo failed to start: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    throw err;
  }
}

function startApiProcess(mongoUri: string): ChildProcess {
  if (!PACKAGED) {
    // Dev: apps/api reads apps/api/.env itself (MONGODB_URI, JWT_SECRET, etc.)
    return spawnChild(NODE_BIN, ["dist/main.js"], path.join(APPS_ROOT, "api"));
  }

  const appConfig = new AppConfig();
  return spawnChild(NODE_BIN, ["dist/main.js"], path.join(APPS_ROOT, "api"), {
    MONGODB_URI: mongoUri,
    JWT_SECRET: appConfig.jwtSecret,
    JWT_EXPIRES_IN: "8h",
    PORT: String(API_PORT),
    CORS_ORIGIN: WEB_URL,
  });
}

function startWebProcess(): ChildProcess {
  // apps/web builds with `output: "standalone"` (see next.config.ts) in both
  // modes now — `next start` refuses to run against a standalone build, so
  // both branches run the standalone server.js directly. Its
  // `outputFileTracingRoot` is the monorepo root, so the entry point lands
  // at .../apps/web/server.js, not .../server.js, in both cases too.
  const webResourceRoot = PACKAGED
    ? path.join(APPS_ROOT, "web")
    : path.join(APPS_ROOT, "web", ".next", "standalone");
  return spawnChild(NODE_BIN, [path.join("apps", "web", "server.js")], webResourceRoot, {
    PORT: String(WEB_PORT),
    HOSTNAME: "127.0.0.1",
    // Not NEXT_PUBLIC_-prefixed (see apps/web/src/lib/api/base-url.ts) — that
    // prefix gets inlined at `next build` time, so setting it here at spawn
    // time would silently have no effect.
    API_BASE_URL: `${API_URL}/api`,
    NODE_ENV: "production",
  });
}

type StartupStep = "database" | "server" | "web";
type StartupStepStatus = "active" | "done" | "error";

/** Drives the splash screen's checklist (src/splash.html) — see onStartupStep in preload.ts. */
function sendStartupStep(step: StartupStep, status: StartupStepStatus, detail?: string): void {
  mainWindow?.webContents.send("startup:step", { step, status, detail });
}

/** See STARTUP_RETRY_ATTEMPTS — retries startMongo() a few times before giving up. */
async function startMongoWithRetry(): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= STARTUP_RETRY_ATTEMPTS; attempt++) {
    try {
      return await startMongo();
    } catch (err) {
      lastError = err;
      log(`[database] attempt ${attempt}/${STARTUP_RETRY_ATTEMPTS} failed: ${err instanceof Error ? err.message : String(err)}`);
      if (attempt < STARTUP_RETRY_ATTEMPTS) {
        sendStartupStep("database", "active", `Retrying… (attempt ${attempt + 1} of ${STARTUP_RETRY_ATTEMPTS})`);
        await new Promise((resolve) => setTimeout(resolve, STARTUP_RETRY_DELAY_MS));
      }
    }
  }
  throw lastError;
}

/**
 * Spawns a child process and waits for it to become healthy, retrying a
 * fresh spawn a few times (see STARTUP_RETRY_ATTEMPTS) if it crashes or
 * never comes up — rather than surfacing an error on the very first hiccup.
 */
async function spawnHealthyWithRetry(
  step: StartupStep,
  healthUrl: string,
  spawnFn: () => ChildProcess,
): Promise<ChildProcess> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= STARTUP_RETRY_ATTEMPTS; attempt++) {
    const child = spawnFn();
    try {
      await waitForHealth(healthUrl, child);
      return child;
    } catch (err) {
      lastError = err;
      log(`[${step}] attempt ${attempt}/${STARTUP_RETRY_ATTEMPTS} failed: ${err instanceof Error ? err.message : String(err)}`);
      child.kill();
      if (attempt < STARTUP_RETRY_ATTEMPTS) {
        sendStartupStep(step, "active", `Retrying… (attempt ${attempt + 1} of ${STARTUP_RETRY_ATTEMPTS})`);
        await new Promise((resolve) => setTimeout(resolve, STARTUP_RETRY_DELAY_MS));
      }
    }
  }
  throw lastError;
}

/**
 * Shows immediately on launch with a local splash page (src/splash.html) —
 * Mongo/api/web startup can take several seconds on a cold start, and an
 * empty window (or no window at all) until they're healthy reads as a hang
 * to a first-time user. `sendStartupStep()` drives the splash's checklist as
 * each stage starts/finishes/fails; `loadURL(WEB_URL)` swaps in the real app
 * once everything is healthy.
 */
async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.on("closed", () => {
    mainWindow = undefined;
  });
  // Awaited so callers can rely on splash.html's IPC listener (registered in
  // its inline <script>) being ready before the first sendStartupStep().
  await mainWindow.loadFile(path.join(__dirname, "splash.html"));
}

function registerIpcHandlers(): void {
  ipcMain.handle("sync:queue-sale", (_event, syncEvent: SyncEventDto) => {
    outbox?.enqueue(syncEvent);
  });
  ipcMain.handle(
    "sync:get-status",
    (): SyncStatus => ({
      online: true,
      pendingCount: outbox?.countPending() ?? 0,
      erroredCount: outbox?.countErrored() ?? 0,
    }),
  );
}

app.whenReady().then(async () => {
  log(`OnePOS starting. packaged=${PACKAGED} version=${app.getVersion()} log=${LOG_PATH}`);
  await createWindow();

  let currentStep: StartupStep = "database";
  try {
    sendStartupStep("database", "active");
    const mongoUri = PACKAGED ? await startMongoWithRetry() : "";
    sendStartupStep("database", "done");

    currentStep = "server";
    sendStartupStep("server", "active");
    apiProcess = await spawnHealthyWithRetry(
      "server",
      `${API_URL}/api/settings/public`,
      () => startApiProcess(mongoUri),
    );
    sendStartupStep("server", "done");

    currentStep = "web";
    sendStartupStep("web", "active");
    webProcess = await spawnHealthyWithRetry("web", WEB_URL, () => startWebProcess());
    sendStartupStep("web", "done");
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    log(`Startup failed at step "${currentStep}": ${detail}`);
    sendStartupStep(currentStep, "error", `${detail} (full log: ${LOG_PATH})`);
    return;
  }

  outbox = new Outbox();
  registerIpcHandlers();
  await mainWindow!.loadURL(WEB_URL);

  syncWorker = new SyncWorker(outbox, mainWindow!.webContents.session, API_URL, () => mainWindow);
  syncWorker.start();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  syncWorker?.stop();
  apiProcess?.kill();
  webProcess?.kill();
  void mongoManager?.stop();
});
