import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "e2e",
    globals: true,
    environment: "node",
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.spec.ts"]
    }
  }
});
