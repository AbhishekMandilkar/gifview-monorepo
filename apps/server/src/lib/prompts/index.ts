// ============================================
// POST ENRICHMENT PROMPTS
// ============================================

/**
 * Prompt for suggesting interests from a list based on post content.
 * Used for hierarchical interest categorization (Main → Sub → SubSub).
 *
 * Placeholders:
 * - @@{INTERESTS_LIST}@@ - List of interests in format "ID: Name"
 * - @@{USER_INPUT}@@ - Post content (title + description + content)
 */
export const POST_TO_INTEREST_PROMPT = `
You are an AI assistant specializing in content analysis and interest categorization. Your task is to analyze the given text and suggest the most relevant interests from the provided list. Follow these guidelines:

1. Analyze the given text thoroughly, considering the topic, tone, and context.
2. From the list of interests provided below, select all relevant ones that match the content of the text.
3. Rank your selections by relevance, with the most pertinent interest first.
4. Return only the IDs of the interests, one per line, without any additional explanation or commentary.
5. If no existing interest is a good match, you may suggest one new interest that accurately represents the content. Place this suggestion at the end of your list and prefix it with "NEW:".
6. Give only the top 3 interests.

Remember:
- Be specific in your selections. If multiple related interests exist, choose the most precise matches.
- Consider both explicit and implicit themes in the content.
- If the content is multilingual, base your decision on the overall meaning, not just the English parts.
- Suggest as many interests as you find relevant. There is no minimum or maximum limit.

Here is the list of available interests (format is ID: Name):

@@{INTERESTS_LIST}@@

Now, analyze the following text and suggest relevant interest IDs:

@@{USER_INPUT}@@`;

/**
 * Prompt for extracting topics from post content for GIF search.
 * Extracts categories like Brand, Product, Event, Action, etc.
 *
 * Placeholders:
 * - @@{USER_INPUT}@@ - Post content (title: description content)
 */
export const TOPIC_EXTRACTION_PROMPT = `
Analyze the provided text and extract specific information based on the following criteria:

1. Brand: If the text refers to a brand, extract the name of the brand and prefix it with "Brand: ".
2. Product: If the text refers to a product, extract the name of the product and prefix it with "Product: ".
3. Event: If the text refers to a seasonal or recurring event (e.g., Christmas, Black Friday), extract the event name and prefix it with "Event: ".
4. Action: If the text describes an action or activity (e.g., running, cooking), extract the action name and prefix it with "Action: ".
5. Sports Team: If the text mentions a sports team, extract the team name and prefix it with "Sports team: ".
6. Celebrity: If the text refers to a celebrity or public figure, extract the name and prefix it with "Celebrity: ".
7. Location: If the text mentions a specific place or location (e.g., New York, Paris), extract the name and prefix it with "Location: ".
8. Emotion: If the text describes a feeling or emotional state (e.g., joy, frustration), extract the emotion and prefix it with "Emotion: ".
9. Weather: If the text describes weather conditions (e.g., sunny, rainy), extract the description and prefix it with "Weather: ".

If none of the above criteria apply, provide 2-3 relevant tags summarizing the main ideas in the text, prefixed by "Other: "

Content: @@{USER_INPUT}@@
`;

// ============================================
// PROMPT HELPERS
// ============================================

/**
 * Build the interest suggestion prompt with the given interests list and user input.
 */
export function buildInterestPrompt(interestsList: string, userInput: string): string {
  return POST_TO_INTEREST_PROMPT
    .replace("@@{INTERESTS_LIST}@@", interestsList)
    .replace("@@{USER_INPUT}@@", userInput);
}

/**
 * Build the topic extraction prompt with the given user input.
 */
export function buildTopicPrompt(userInput: string): string {
  return TOPIC_EXTRACTION_PROMPT.replace("@@{USER_INPUT}@@", userInput);
}
