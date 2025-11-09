import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { BenchmarkQuery, BenchmarkQuerySetSchema } from "@truthlayer/schema";

export async function loadQueries(filePath: string): Promise<BenchmarkQuery[]> {
  // If path is relative, resolve it relative to the project root (3 levels up from collector)
  const resolvedPath = filePath.startsWith('/')
    ? filePath
    : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..', filePath);

  const raw = await fs.readFile(resolvedPath, "utf-8");
  const json = JSON.parse(raw);
  return BenchmarkQuerySetSchema.parse(json);
}

