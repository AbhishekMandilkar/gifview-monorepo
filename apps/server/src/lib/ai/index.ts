// AI Service - OpenAI wrapper using Vercel AI SDK
// Usage:
//   import { generateAIText, generateAIObject } from "./lib/ai";

export { generateAIText, generateAIObject } from "./ai.service";

export type {
  GenerateTextOptions,
  GenerateTextResult,
  GenerateObjectOptions,
  GenerateObjectResult,
} from "./ai.types";
