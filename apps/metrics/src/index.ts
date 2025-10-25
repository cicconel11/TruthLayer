import { fileURLToPath } from "node:url";
import path from "node:path";
import { createMetricsApp } from "./launcher";

export { createMetricsApp } from "./launcher";

async function main() {
  const app = createMetricsApp();
  await app.run();
}

const isDirectExecution = (() => {
  if (typeof process === "undefined" || typeof import.meta.url !== "string") return false;
  if (!process.argv?.[1]) return false;
  const current = fileURLToPath(import.meta.url);
  return path.resolve(current) === path.resolve(process.argv[1]);
})();

if (isDirectExecution) {
  main().catch((error) => {
    console.error("Metrics service failed", error);
    process.exitCode = 1;
  });
}
