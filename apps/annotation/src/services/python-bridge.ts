import { spawn } from "node:child_process";
import path from "node:path";
import { AnnotationConfig } from "../lib/config";
import { Logger } from "../lib/logger";
import {
  LLMClient,
  LLMAnnotationInput,
  LLMAnnotationResult,
  buildPrompt,
  defaultAnnotationResult,
  normalizeAnnotationResult
} from "./llm-client";
import { inferDomainType, inferFactualConsistency } from "./heuristics";

interface BridgeResponse {
  annotation: {
    domain_type?: string;
    factual_consistency?: string;
    confidence?: number;
    reasoning?: string;
  };
  model: string;
}

function runPythonBridge({
  executable,
  scriptPath,
  payload,
  env
}: {
  executable: string;
  scriptPath: string;
  payload: Record<string, unknown>;
  env: NodeJS.ProcessEnv;
}): Promise<BridgeResponse> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [scriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ...env
      }
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => reject(error));

    child.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`Claude bridge exited with code ${code}: ${stderr}`));
      }

      try {
        const parsed = JSON.parse(stdout) as BridgeResponse;
        resolve(parsed);
      } catch (error) {
        reject(new Error(`Failed to parse bridge output: ${stdout}\n${error}`));
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

export function createClaudeBridgeAnnotator({
  config,
  logger
}: {
  config: AnnotationConfig;
  logger: Logger;
}): LLMClient {
  if (!config.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is required for Claude annotations");
  }

  const executable = config.claudePythonExecutable;
  const script = path.resolve(config.claudeBridgePath);

  async function annotate(input: LLMAnnotationInput): Promise<LLMAnnotationResult> {
    const fallbackDomain = inferDomainType(input.domain);
    const fallbackFactual = inferFactualConsistency(input.snippet);

    const payload = {
      model: config.model,
      system: `You are an annotation assistant classifying search results. Prompt version ${config.promptVersion}. Respond with JSON.`,
      prompt: buildPrompt(input)
    };

    try {
      const response = await runPythonBridge({
        executable,
        scriptPath: script,
        payload,
        env: {
          ANTHROPIC_API_KEY: config.anthropicApiKey
        }
      });

      const annotation = response.annotation ?? {};
      const confidence =
        typeof annotation.confidence === "number"
          ? annotation.confidence
          : typeof annotation.confidence === "string"
            ? Number.parseFloat(annotation.confidence)
            : null;
      const candidate = normalizeAnnotationResult({
        candidate: {
          domainType: annotation.domain_type,
          factualConsistency: annotation.factual_consistency,
          confidence,
          reasoning: annotation.reasoning,
          provider: "claude",
          modelId: response.model,
          raw: response
        },
        fallbackDomain,
        fallbackFactual
      });

      return candidate;
    } catch (error) {
      logger.error("Claude bridge annotation failed", {
        error,
        engine: input.engine,
        queryId: input.queryId,
        url: input.url
      });
      return defaultAnnotationResult(input, "claude");
    }
  }

  return {
    provider: "claude",
    annotate
  };
}
