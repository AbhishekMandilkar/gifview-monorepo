import { generateAIText } from "../../lib/ai";
import { buildTopicPrompt } from "../../lib/prompts";
import { createLogger } from "../../utils/logger";

const logger = createLogger("Topic Service");

/**
 * Extract topic categories from post content for GIF search.
 * Returns formatted string like:
 * "Brand: Apple, iPhone
 *  Emotion: excited
 *  Action: unboxing"
 */
export async function suggestTopic(
  title: string,
  description: string,
  content?: string | null
): Promise<string> {
  const userMsg = buildUserMsg(title, description, content);
  const prompt = buildTopicPrompt(userMsg);

  logger.debug("Extracting topic from post content");

  try {
    const result = await generateAIText({
      prompt,
      model: "gpt-4o-mini", // Use smaller model for cost efficiency
      temperature: 0.3, // Lower temperature for more consistent results
    });

    logger.debug(`Topic extracted: ${result.text.substring(0, 100)}...`);
    return result.text;
  } catch (error) {
    logger.error("Failed to extract topic:", error);
    throw error;
  }
}

/**
 * Build user message from post content parts.
 */
function buildUserMsg(
  title: string,
  description: string,
  content?: string | null
): string {
  return `${title}: ${description} ${content ? content : ""}`.trim();
}
