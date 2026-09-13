import { searchGoogle, type SearchResult } from "./google-search";
import { searchYouTube, type YouTubeResult } from "./youtube-search";
import { searchLinkedIn } from "./linkedin-search";

export type SearchSourceType = "web" | "youtube" | "linkedin";

export interface ResourceSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: SearchSourceType;
  author?: string;
  duration?: string;
  views?: number;
}

/**
 * Unified search across multiple sources.
 * Runs requested search types in parallel, deduplicates by URL.
 */
export async function searchResources(
  query: string,
  types: SearchSourceType[] = ["web", "youtube"],
  limit: number = 5
): Promise<ResourceSearchResult[]> {
  const promises: Promise<ResourceSearchResult[]>[] = [];

  if (types.includes("web")) {
    promises.push(
      searchGoogle(query, limit).then((results) =>
        results.map(
          (r: SearchResult): ResourceSearchResult => ({
            title: r.title,
            url: r.link,
            snippet: r.snippet,
            source: "web",
          })
        )
      )
    );
  }

  if (types.includes("youtube")) {
    promises.push(
      searchYouTube(query, limit).then((results) =>
        results.map(
          (r: YouTubeResult): ResourceSearchResult => ({
            title: r.title,
            url: r.url,
            snippet: r.description,
            source: "youtube",
            author: r.author,
            duration: r.duration,
            views: r.views,
          })
        )
      )
    );
  }

  if (types.includes("linkedin")) {
    promises.push(
      searchLinkedIn(query, limit).then((results) =>
        results.map(
          (r: SearchResult): ResourceSearchResult => ({
            title: r.title,
            url: r.link,
            snippet: r.snippet,
            source: "linkedin",
          })
        )
      )
    );
  }

  const allResults = (await Promise.all(promises)).flat();

  // Deduplicate by URL
  const seen = new Set<string>();
  return allResults.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}
