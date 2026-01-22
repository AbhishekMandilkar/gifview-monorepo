import type { z } from "zod";

// ============================================
// TEXT GENERATION OPTIONS
// ============================================

export interface GenerateTextOptions {
  /** The prompt to send to the AI model */
  prompt: string;
  /** The model to use (defaults to "gpt-4o") */
  model?: string;
  /** Optional system prompt to set context */
  system?: string;
  /** Temperature for response randomness (defaults to 0.7) */
  temperature?: number;
  /** Maximum tokens in the response */
  maxTokens?: number;
}

// ============================================
// STRUCTURED OUTPUT OPTIONS
// ============================================

export interface GenerateObjectOptions<T> {
  /** The prompt to send to the AI model */
  prompt: string;
  /** Zod schema defining the expected output structure */
  schema: z.ZodSchema<T>;
  /** The model to use (defaults to "gpt-4o") */
  model?: string;
  /** Optional system prompt to set context */
  system?: string;
  /** Temperature for response randomness (defaults to 0.7) */
  temperature?: number;
  /** Maximum tokens in the response */
  maxTokens?: number;
}

// ============================================
// RESPONSE TYPES
// ============================================

export interface GenerateTextResult {
  /** The generated text content */
  text: string;
  /** Token usage information */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface GenerateObjectResult<T> {
  /** The generated structured object */
  object: T;
  /** Token usage information */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
