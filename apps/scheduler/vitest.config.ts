import path from "node:path";
import { defineConfig } from "vitest/config";

const resolveFromRoot = (relativePath: string) =>
  path.resolve(__dirname, relativePath);

export default defineConfig({
  test: {
    environment: "node"
  },
  resolve: {
    alias: {
      "@truthlayer/config": resolveFromRoot("../../packages/config/src/index.ts"),
      "@truthlayer/collector": resolveFromRoot("../collector/src/index.ts"),
      "@truthlayer/annotation": resolveFromRoot("../annotation/src/index.ts"),
      "@truthlayer/metrics": resolveFromRoot("../metrics/src/index.ts")
    }
  }
});
