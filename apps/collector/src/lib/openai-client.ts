/**
 * Enhanced OpenAI client with retry logic, structured error handling,
 * and robust error extraction for the TruthLayer annotation pipeline.
 */

import OpenAI from "openai";
import { withRetry, isOpenAIRetryable } from "./retry";

export interface OpenAIErrorInfo {
  code: string | null;
  status: number | null;
  message: string;
  requestId: string | null;
  model: string;
  inputChars: number;
  attempt: number;
}

/**
 * Extracts structured error information from OpenAI API errors.
 *
 * Captures all relevant error details for debugging and telemetry.
 *
 * @param error - Raw error from OpenAI API
 * @param model - Model that was used
 * @param inputChars - Length of input text
 * @param attempt - Which retry attempt this was
 * @returns Structured error information
 */
export function extractErrorInfo(
  error: any,
  model: string,
  inputChars: number,
  attempt: number = 1
): OpenAIErrorInfo {
  return {
    code: error?.code ?? error?.error?.code ?? null,
    status: error?.status ?? error?.response?.status ?? null,
    message: error?.message ?? error?.error?.message ?? String(error),
    requestId: error?.response?.headers?.["x-request-id"] ??
               error?.headers?.["x-request-id"] ??
               error?.error?.request_id ?? null,
    model,
    inputChars,
    attempt
  };
}

/**
 * Creates and configures OpenAI client with startup validation.
 *
 * @param apiKey - OpenAI API key
 * @returns Configured OpenAI client
 */
export function createOpenAIClient(apiKey: string): OpenAI {
  if (!apiKey) {
    throw Object.assign(new Error("OPENAI_API_KEY is required"), { code: "CONFIG_MISSING" });
  }

  return new OpenAI({
    apiKey,
    timeout: 30000, // 30 second timeout
    maxRetries: 0, // We handle retries ourselves
  });
}

/**
 * Makes a single OpenAI chat completion request with structured error handling.
 *
 * @param client - OpenAI client instance
 * @param prompt - Prompt text
 * @param model - Model to use
 * @returns Chat completion response
 */
async function makeOpenAIRequest(
  client: OpenAI,
  prompt: string,
  model: string
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  return client.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1, // Low temperature for consistent results
    max_tokens: 1000, // Limit response length
    timeout: 30000,
  });
}

/**
 * Annotates content using OpenAI with retry logic and structured error handling.
 *
 * @param prompt - Formatted prompt for annotation
 * @param model - OpenAI model to use
 * @param apiKey - OpenAI API key
 * @returns Promise resolving to annotation text or throwing structured error
 */
export async function annotateWithOpenAI(
  prompt: string,
  model: string,
  apiKey: string
): Promise<string> {
  const client = createOpenAIClient(apiKey);
  const inputChars = prompt.length;

  let attempt = 0;

  const result = await withRetry(
    async () => {
      attempt++;
      try {
        const response = await makeOpenAIRequest(client, prompt, model);
        const content = response.choices[0]?.message?.content;

        if (!content) {
          throw Object.assign(new Error("Empty response from OpenAI"), {
            code: "EMPTY_RESPONSE",
            status: response.status
          });
        }

        return content;
      } catch (error: any) {
        // Enhance error with attempt info
        error.attempt = attempt;
        throw error;
      }
    },
    isOpenAIRetryable,
    { retries: 3, baseMs: 1000, maxMs: 8000, jitter: 0.2 }
  );

  return result;
}

/**
 * Performs startup sanity check for OpenAI configuration.
 *
 * @param apiKey - OpenAI API key to validate
 * @param model - Model to test with
 */
export async function validateOpenAIConfig(apiKey: string, model: string): Promise<void> {
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }

  try {
    const client = createOpenAIClient(apiKey);

    // Simple test request to validate key and model
    await client.models.list();

  } catch (error: any) {
    const info = extractErrorInfo(error, model, 0, 1);
    throw new Error(`OpenAI configuration invalid: ${info.message} (status: ${info.status})`);
  }
}
