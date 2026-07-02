import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Monorepo: trace from the repo root so workspace packages (@onepos/shared-types)
  // and hoisted node_modules resolve correctly in the standalone build.
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
