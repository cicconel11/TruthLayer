import { fileURLToPath } from "node:url";
import path from "node:path";
import { createCollectorApp } from "./launcher";

export { createCollectorApp } from "./launcher";

async function main() {
  const app = await createCollectorApp();
  await app.run();
}

const isDirectExecution = (() => {
  if (typeof process === "undefined") return false;
  const entry = process.argv?.[1];
  if (typeof entry !== "string") return false;

  let current: string | undefined;

  if (typeof import.meta !== "undefined" && typeof import.meta.url === "string") {
    current = fileURLToPath(import.meta.url);
  } else if (typeof __filename === "string") {
    current = __filename;
  }

  if (!current) return false;

  return path.resolve(current) === path.resolve(entry);
})();

if (isDirectExecution) {
  main().catch((error) => {
    console.error("Collector failed", error);
    process.exitCode = 1;
  });
}
