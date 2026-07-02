import { MongoMemoryServer } from "mongodb-memory-server-core";
import fs from "node:fs";

const DB_NAME = "onepos";
/** Deliberately different from the dev Docker Mongo's 27017, so both can run side by side. */
const DEFAULT_PORT = 27018;

export interface MongoManagerOptions {
  dbPath: string;
  port?: number;
  /**
   * Packaged mode: directory a mongod binary was already downloaded into at
   * build time (see scripts/fetch-mongo.js), pinned via `binaryVersion` — the
   * same pair of options that script used, so this resolves the cached
   * binary without attempting a runtime download.
   */
  binaryDownloadDir?: string;
  binaryVersion?: string;
}

/**
 * Bundled, single-machine MongoDB instance backing the packaged app — see
 * docs (Phase 4/5 install story). Bound to 127.0.0.1 only, persistent
 * `dbPath` under Electron's userData dir (never the library's ephemeral
 * tmp-dir mode used in tests, so `stop()`'s default cleanup never touches
 * real data — see MongoMemoryServer.stop()'s "cleanup temporary, but not
 * custom dbpaths" behavior).
 */
export class MongoManager {
  private server: MongoMemoryServer | undefined;

  constructor(private readonly options: MongoManagerOptions) {}

  async start(): Promise<string> {
    fs.mkdirSync(this.options.dbPath, { recursive: true });

    this.server = await MongoMemoryServer.create({
      instance: {
        port: this.options.port ?? DEFAULT_PORT,
        ip: "127.0.0.1",
        dbPath: this.options.dbPath,
        storageEngine: "wiredTiger",
        dbName: DB_NAME,
      },
      binary: this.options.binaryDownloadDir
        ? { downloadDir: this.options.binaryDownloadDir, version: this.options.binaryVersion }
        : undefined,
    });

    return this.server.getUri(DB_NAME);
  }

  async stop(): Promise<void> {
    await this.server?.stop({ doCleanup: false });
  }
}
