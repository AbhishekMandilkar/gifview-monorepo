import { generateAIText } from "../../lib/ai";
import { buildInterestPrompt } from "../../lib/prompts";
import * as interestDbService from "../../services/interestService";
import { createLogger } from "../../utils/logger";
import { InterestsDepth, type SuggestInterestsParams } from "./post-enrichment.interfaces";

const logger = createLogger("Interest Suggestion Service");

/**
 * Suggest interests for a post using hierarchical AI analysis.
 * Returns array of interest IDs across all three levels (main, sub, subsub).
 */
export async function suggestInterests(params: SuggestInterestsParams): Promise<string[]> {
  const { title, description, content } = params;

  logger.debug("Starting hierarchical interest suggestion");

  try {
    // Build user message for AI
    const userMsg = `${title.trim()}\n${description.trim()}\n${content ? content.trim() : ""}`;

    // Process interests hierarchically
    const mainInterests = await getInterestsForDepth(
      InterestsDepth.Main,
      [],
      userMsg
    );
    logger.debug(`Found ${mainInterests.length} main interests`);

    const subInterests = await getInterestsForDepth(
      InterestsDepth.Sub,
      mainInterests,
      userMsg
    );
    logger.debug(`Found ${subInterests.length} sub interests`);

    const subSubInterests = await getInterestsForDepth(
      InterestsDepth.SubSub,
      subInterests,
      userMsg
    );
    logger.debug(`Found ${subSubInterests.length} subsub interests`);

    // Combine all results
    const allInterests = [...mainInterests, ...subInterests, ...subSubInterests];
    logger.info(`Total interests suggested: ${allInterests.length}`);

    return allInterests;
  } catch (error) {
    logger.error("Error suggesting interests:", error);
    throw error;
  }
}

/**
 * Get interests for a specific depth level.
 * Filters by parent IDs for sub/subsub levels.
 */
async function getInterestsForDepth(
  depth: InterestsDepth,
  parentIds: string[],
  userMsg: string
): Promise<string[]> {
  // Skip if no parents for sub/subsub levels
  if (parentIds.length === 0 && depth !== InterestsDepth.Main) {
    return [];
  }

  // Fetch interests from database using service
  const dbInterests = await interestDbService.getActiveInterestsByDepth(
    depth,
    depth !== InterestsDepth.Main ? parentIds : undefined
  );

  if (dbInterests.length === 0) {
    logger.debug(`No interests found for depth ${depth}`);
    return [];
  }

  // Build interests list for prompt
  const interestsList = dbInterests
    .map((i) => `${i.id}: ${i.nameEn}`)
    .join("\n");

  // Build prompt
  const prompt = buildInterestPrompt(interestsList, userMsg);

  // Call AI
  const result = await generateAIText({
    prompt,
    model: "gpt-4o-mini", // Use smaller model for cost efficiency
    temperature: 0.3, // Lower temperature for more consistent results
  });

  // Parse response and validate against DB interests
  const validIds = new Set(dbInterests.map((i) => i.id));
  
  return result.text
    ? result.text
        .trim()
        .split("\n")
        .map((line) => line.trim())
        .filter((id) => validIds.has(id))
    : [];
}
