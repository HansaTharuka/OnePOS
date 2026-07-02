#!/usr/bin/env node
// Stages a self-contained apps/api (compiled dist/ + its own production
// node_modules) for electron-builder's extraResources. The node_modules here
// must be installed with the *bundled* Node binary (scripts/fetch-node.js),
// not whatever Node built this monorepo's root node_modules — otherwise
// bcrypt's native binary won't match the ABI it actually runs under once
// packaged (src/main.ts's packaged-mode branch runs apps/api under the
// bundled Node, not Electron's own).
//
// Installs fresh from apps/api/package.json's dependency ranges (`npm
// install`, not `npm ci`) rather than reusing the monorepo's root
// package-lock.json, since that lockfile spans the whole workspace and isn't
// directly usable for an isolated single-package install — a known
// simplification, not a strict-reproducibility guarantee.
//
// @onepos/shared-types can't be resolved by a plain `npm install` outside
// the workspace (it's unpublished), so it's stripped from the staged
// package.json before installing and copied in from its own build output
// afterward instead.
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const API_ROOT = path.join(__dirname, "..", "..", "api");
const SHARED_TYPES_ROOT = path.join(__dirname, "..", "..", "..", "packages", "shared-types");
const STAGING_DIR = path.join(__dirname, "..", "staging", "api");
const NODE_EXE = path.join(__dirname, "..", "vendor", "node", "node.exe");
const NPM_CLI = path.join(
  __dirname,
  "..",
  "vendor",
  "node",
  "node_modules",
  "npm",
  "bin",
  "npm-cli.js",
);

function main() {
  if (!fs.existsSync(NODE_EXE)) {
    throw new Error(`Bundled Node runtime not found at ${NODE_EXE} — run "npm run fetch:node" first.`);
  }
  if (!fs.existsSync(path.join(SHARED_TYPES_ROOT, "dist"))) {
    throw new Error(
      `${SHARED_TYPES_ROOT}/dist not found — run "npm run build" at the repo root first.`,
    );
  }

  console.log("[build-api-resources] Building apps/api...");
  // .cmd files aren't directly executable on Windows — need shell:true to run
  // npm.cmd at all. Args here are static/hardcoded, so the args-escaping
  // deprecation warning shell:true triggers doesn't apply (no untrusted input).
  const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
  execFileSync(npmBin, ["run", "build"], { cwd: API_ROOT, stdio: "inherit", shell: true });

  console.log(`[build-api-resources] Staging into ${STAGING_DIR}...`);
  try {
    fs.rmSync(STAGING_DIR, { recursive: true, force: true });
  } catch (err) {
    // Most likely a stale previous run of the staged api is still holding
    // the directory open (e.g. someone ran dist/main.js from here manually).
    // Don't hard-fail — overwrite in place; npm install and the dist copy
    // below will still bring everything up to date.
    console.warn(
      `[build-api-resources] Could not remove old staging dir (probably still in use by a running process) — reusing it in place: ${err.message}`,
    );
  }
  fs.mkdirSync(STAGING_DIR, { recursive: true });
  fs.cpSync(path.join(API_ROOT, "dist"), path.join(STAGING_DIR, "dist"), { recursive: true });

  const pkg = JSON.parse(fs.readFileSync(path.join(API_ROOT, "package.json"), "utf-8"));
  delete pkg.dependencies["@onepos/shared-types"];
  delete pkg.devDependencies;
  delete pkg.scripts;
  fs.writeFileSync(path.join(STAGING_DIR, "package.json"), JSON.stringify(pkg, null, 2));

  console.log("[build-api-resources] Installing production deps with the bundled Node...");
  execFileSync(NODE_EXE, [NPM_CLI, "install", "--omit=dev", "--no-audit", "--no-fund"], {
    cwd: STAGING_DIR,
    stdio: "inherit",
  });

  console.log("[build-api-resources] Copying @onepos/shared-types build output in...");
  const sharedTypesDest = path.join(STAGING_DIR, "node_modules", "@onepos", "shared-types");
  fs.mkdirSync(sharedTypesDest, { recursive: true });
  fs.cpSync(path.join(SHARED_TYPES_ROOT, "dist"), path.join(sharedTypesDest, "dist"), {
    recursive: true,
  });
  fs.copyFileSync(
    path.join(SHARED_TYPES_ROOT, "package.json"),
    path.join(sharedTypesDest, "package.json"),
  );

  console.log("[build-api-resources] Done.");
}

try {
  main();
} catch (err) {
  console.error("[build-api-resources] Failed:", err);
  process.exit(1);
}
