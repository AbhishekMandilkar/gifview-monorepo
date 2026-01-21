import axios from "axios";
import { JSDOM } from "jsdom";
import { createLogger } from "./logger";

const logger = createLogger("HTML Utils");

const FALLBACK_SELECTORS = [
  "article",
  ".post-content",
  ".entry-content",
  ".content",
  "main",
];

const REQUEST_TIMEOUT = 30000; // 30 seconds

export async function extractContentFromHTML(
  url: string,
  selector?: string
): Promise<string | null> {
  try {
    logger.info(`Fetching content from: ${url}`);

    const response = await axios.get(url, {
      timeout: REQUEST_TIMEOUT,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RSSBot/1.0)",
      },
    });

    if (response.status !== 200) {
      logger.error(`Failed to fetch URL: ${response.statusText}`);
      return null;
    }

    const dom = new JSDOM(response.data);
    const document = dom.window.document;

    if (!selector) {
      // Fallback: try common content selectors
      for (const fallback of FALLBACK_SELECTORS) {
        const element = document.querySelector(fallback);
        if (element?.textContent?.trim()) {
          logger.info(`Found content using fallback selector: ${fallback}`);
          return element.textContent.trim();
        }
      }
      logger.warn(`No content found with fallback selectors for: ${url}`);
      return null;
    }

    const elements = document.querySelectorAll(selector);
    let content = "";

    elements.forEach((element: Element) => {
      const text = element.textContent?.trim();
      if (text) {
        content += text + "\n";
      }
    });

    const trimmedContent = content.trim();
    if (trimmedContent) {
      logger.info(`Extracted ${trimmedContent.length} characters from: ${url}`);
      return trimmedContent;
    }

    logger.warn(`No content found with selector "${selector}" for: ${url}`);
    return null;
  } catch (error) {
    logger.error(`Error extracting content from ${url}:`, error);
    return null;
  }
}
