import { promises as fs } from "fs";
import { BenchmarkQuery, BenchmarkQuerySetSchema } from "@truthlayer/schema";

export async function loadQueries(filePath: string): Promise<BenchmarkQuery[]> {
  const raw = await fs.readFile(filePath, "utf-8");
  const json = JSON.parse(raw);
  return BenchmarkQuerySetSchema.parse(json);
}

