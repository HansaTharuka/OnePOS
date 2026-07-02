#!/usr/bin/env node
// Pre-downloads the mongod binary MongoManager (src/mongo-manager.ts) drives
// at runtime, into a bundled vendor directory — so a packaged install never
// needs internet access just to start its local database. Run once at
// packaging time (see package.json's `package` script); dev mode doesn't
// need this, `npm run dev` still points at the Docker Mongo container.
const path = require("node:path");
const { MongoBinary } = require("mongodb-memory-server-core");

const DOWNLOAD_DIR = path.join(__dirname, "..", "vendor", "mongodb-binaries");
const VERSION = process.env.ONEPOS_MONGO_VERSION || "7.0.14";

async function main() {
  console.log(`[fetch-mongo] Resolving mongod v${VERSION} for Windows x64 into ${DOWNLOAD_DIR}...`);
  const binaryPath = await MongoBinary.getPath({ version: VERSION, downloadDir: DOWNLOAD_DIR });
  console.log(`[fetch-mongo] Ready at ${binaryPath}`);
}

main().catch((err) => {
  console.error("[fetch-mongo] Failed:", err);
  process.exit(1);
});
