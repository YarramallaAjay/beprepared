import { searchGoogle, type SearchResult } from "./google-search";

/**
 * Search for LinkedIn public content via Google Custom Search.
 * LinkedIn is included in the Programmable Search Engine's site list,
 * so we add "linkedin" to the query to bias results toward LinkedIn content.
 */
export async function searchLinkedIn(
  query: string,
  num: number = 5
): Promise<SearchResult[]> {
  const results = await searchGoogle(`${query} linkedin`, num);
  // Filter to only LinkedIn URLs
  return results.filter((r) => r.link.includes("linkedin.com"));
}
