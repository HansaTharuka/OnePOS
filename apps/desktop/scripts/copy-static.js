#!/usr/bin/env node
// tsc only compiles .ts files — static assets referenced at runtime by
// __dirname-relative paths (main.ts's loadFile(".../splash.html")) need a
// separate copy step into dist/.
const fs = require("node:fs");
const path = require("node:path");

const SRC_DIR = path.join(__dirname, "..", "src");
const DIST_DIR = path.join(__dirname, "..", "dist");
const STATIC_FILES = ["splash.html"];

for (const file of STATIC_FILES) {
  fs.copyFileSync(path.join(SRC_DIR, file), path.join(DIST_DIR, file));
}
