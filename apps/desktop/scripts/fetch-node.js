#!/usr/bin/env node
// Downloads a portable Node.js Windows x64 runtime, used at packaging time to
// run apps/api and apps/web (standalone) inside the installed app so end
// users don't need Node.js installed themselves. apps/api's production
// node_modules must be installed *with this same binary* (see
// scripts/build-api-resources.js) so bcrypt's native binary matches this
// exact Node ABI — bundling the wrong version here would break login at
// runtime with no electron-rebuild-style safety net to catch it at build time.
//
// Extraction uses PowerShell's Expand-Archive rather than the `extract-zip`
// npm package: on this project's dev sandbox, `extract-zip` silently drops
// .exe files and their supporting folders (node.exe, node_modules, npm)
// after writing them — observed with both electron.exe and node.exe here,
// consistent with AV real-time-scanning behavior that Expand-Archive doesn't
// trip. Expand-Archive is a synchronous whole-file write, extract-zip streams.
const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");
const { execFileSync } = require("node:child_process");

const NODE_VERSION = process.env.ONEPOS_NODE_VERSION || "24.16.0";
const VENDOR_DIR = path.join(__dirname, "..", "vendor", "node");
const ARCHIVE_NAME = `node-v${NODE_VERSION}-win-x64`;
const DOWNLOAD_URL = `https://nodejs.org/dist/v${NODE_VERSION}/${ARCHIVE_NAME}.zip`;

function download(url, destPath) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          download(res.headers.location, destPath).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download ${url}: HTTP ${res.statusCode}`));
          return;
        }
        const file = fs.createWriteStream(destPath);
        res.pipe(file);
        file.on("finish", () => file.close(resolve));
        file.on("error", reject);
      })
      .on("error", reject);
  });
}

async function main() {
  const nodeExe = path.join(VENDOR_DIR, "node.exe");
  if (fs.existsSync(nodeExe)) {
    console.log(`[fetch-node] Already present at ${nodeExe}`);
    return;
  }

  fs.mkdirSync(VENDOR_DIR, { recursive: true });
  const zipPath = path.join(VENDOR_DIR, `${ARCHIVE_NAME}.zip`);

  console.log(`[fetch-node] Downloading Node v${NODE_VERSION} for Windows x64...`);
  await download(DOWNLOAD_URL, zipPath);

  console.log("[fetch-node] Extracting...");
  const extractDir = path.join(VENDOR_DIR, "_extracted");
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `Expand-Archive -Path "${zipPath}" -DestinationPath "${extractDir}" -Force`,
    ],
    { stdio: "inherit" },
  );

  // The zip contains a single top-level "node-vX.Y.Z-win-x64/" folder —
  // flatten its contents directly into vendor/node/.
  const innerDir = path.join(extractDir, ARCHIVE_NAME);
  for (const entry of fs.readdirSync(innerDir)) {
    fs.renameSync(path.join(innerDir, entry), path.join(VENDOR_DIR, entry));
  }
  fs.rmSync(extractDir, { recursive: true, force: true });
  fs.rmSync(zipPath, { force: true });

  console.log(`[fetch-node] Ready at ${nodeExe}`);
}

main().catch((err) => {
  console.error("[fetch-node] Failed:", err);
  process.exit(1);
});
