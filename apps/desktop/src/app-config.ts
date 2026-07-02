import { app } from "electron";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

interface PersistedAppConfig {
  jwtSecret: string;
}

/**
 * Secrets the packaged app needs to run apps/api, generated once on first
 * launch and reused after that. Passed to the spawned api child process via
 * `env` (ConfigModule.forRoot has no envFilePath override, so it reads
 * process.env directly — no .env file needs to live under Program Files).
 */
export class AppConfig {
  private readonly configPath: string;
  private config: PersistedAppConfig;

  constructor(userDataPath: string = app.getPath("userData")) {
    this.configPath = path.join(userDataPath, "app-config.json");
    this.config = this.loadOrCreate();
  }

  get jwtSecret(): string {
    return this.config.jwtSecret;
  }

  private loadOrCreate(): PersistedAppConfig {
    try {
      const raw = fs.readFileSync(this.configPath, "utf-8");
      return JSON.parse(raw) as PersistedAppConfig;
    } catch {
      const fresh: PersistedAppConfig = { jwtSecret: randomBytes(32).toString("hex") };
      fs.mkdirSync(path.dirname(this.configPath), { recursive: true });
      fs.writeFileSync(this.configPath, JSON.stringify(fresh, null, 2));
      return fresh;
    }
  }
}
