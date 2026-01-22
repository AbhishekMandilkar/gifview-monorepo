import { createOpenAI } from "@ai-sdk/openai";
import { generateText, generateObject } from "ai";
import { env } from "@gifview-monorepo/env/server";
import { createLogger } from "../../utils/logger";
import type {
  GenerateTextOptions,
  GenerateTextResult,
  GenerateObjectOptions,
  GenerateObjectResult,
} from "./ai.types";

// ============================================
// CONFIGURATION
// ============================================

const logger = createLogger("AI Service");

const DEFAULT_MODEL = "gpt-4o";
const DEFAULT_TEMPERATURE = 0.7;

// Initialize OpenAI provider
const openai = createOpenAI({
  apiKey: env.OPENAI_API_KEY,
});

// ============================================
// TEXT GENERATION
// ============================================

/**
 * Generate text using OpenAI.
 *
 * @example
 * ```ts
 * const result = await generateAIText({
 *   prompt: "Summarize this article...",
 *   system: "You are a helpful assistant",
 * });
 * console.log(result.text);
 * ```
 */
export async function generateAIText(
  options: GenerateTextOptions
): Promise<GenerateTextResult> {
  const {
    prompt,
    model = DEFAULT_MODEL,
    system,
    temperature = DEFAULT_TEMPERATURE,
    maxTokens,
  } = options;

  logger.debug(`Generating text with model: ${model}`);

  const result = await generateText({
    model: openai(model),
    prompt,
    system,
    temperature,
    maxOutputTokens: maxTokens,
  });

  logger.debug(`Generated ${result.text.length} characters`);

  return {
    text: result.text,
    usage: result.usage
      ? {
          promptTokens: result.usage.inputTokens ?? 0,
          completionTokens: result.usage.outputTokens ?? 0,
          totalTokens:
            (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
        }
      : undefined,
  };
}

// ============================================
// STRUCTURED OUTPUT
// ============================================

/**
 * Generate structured output using OpenAI with a Zod schema.
 *
 * @example
 * ```ts
 * import { z } from "zod";
 *
 * const result = await generateAIObject({
 *   prompt: "Extract key points from this text...",
 *   schema: z.object({
 *     title: z.string(),
 *     points: z.array(z.string()),
 *   }),
 * });
 * console.log(result.object.title);
 * ```
 */
export async function generateAIObject<T>(
  options: GenerateObjectOptions<T>
): Promise<GenerateObjectResult<T>> {
  const {
    prompt,
    schema,
    model = DEFAULT_MODEL,
    system,
    temperature = DEFAULT_TEMPERATURE,
    maxTokens,
  } = options;

  logger.debug(`Generating object with model: ${model}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await generateObject({
    model: openai(model),
    messages: [{ role: "user", content: prompt }],
    schema: schema as any,
    system,
    temperature,
    maxOutputTokens: maxTokens,
  });

  logger.debug("Object generated successfully");

  return {
    object: result.object as T,
    usage: result.usage
      ? {
          promptTokens: result.usage.inputTokens ?? 0,
          completionTokens: result.usage.outputTokens ?? 0,
          totalTokens:
            (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
        }
      : undefined,
  };
}
