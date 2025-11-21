import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const BiasTopicConfigSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  queries: z.array(z.string().min(1)),
  engines: z.array(z.string().min(1)),
  locale: z.string().default("en-US")
});

const BiasTopicsConfigSchema = z.array(BiasTopicConfigSchema);

export type BiasTopicConfig = z.infer<typeof BiasTopicConfigSchema>;

let cachedTopics: BiasTopicConfig[] | null = null;

/**
 * Loads bias topics configuration from configs/bias-topics.json.
 * Results are cached after first load.
 *
 * @returns Promise resolving to array of bias topic configurations
 */
export async function loadBiasTopics(): Promise<BiasTopicConfig[]> {
  if (cachedTopics) {
    return cachedTopics;
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const projectRoot = path.resolve(__dirname, "../../../..");
  const configPath = path.join(projectRoot, "configs", "bias-topics.json");

  try {
    const content = await fs.readFile(configPath, "utf-8");
    const json = JSON.parse(content);
    cachedTopics = BiasTopicsConfigSchema.parse(json);
    return cachedTopics;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load bias topics config: ${error.message}`);
    }
    throw new Error("Failed to load bias topics config: unknown error");
  }
}

/**
 * Gets a bias topic configuration by ID.
 *
 * @param id - Topic ID to look up
 * @returns Topic configuration if found, undefined otherwise
 */
export async function getTopicById(id: string): Promise<BiasTopicConfig | undefined> {
  const topics = await loadBiasTopics();
  return topics.find(topic => topic.id === id);
}

