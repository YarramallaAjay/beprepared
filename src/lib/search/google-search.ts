export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
}

interface SerperResult {
  title: string;
  link: string;
  snippet: string;
}

interface SerperResponse {
  organic?: SerperResult[];
}

/**
 * Search the web using Serper.dev (Google Search API wrapper).
 * Free tier: 2,500 queries (no credit card). Then $1 per 1,000 queries.
 */
export async function searchGoogle(
  query: string,
  num: number = 5
): Promise<SearchResult[]> {
  const apiKey = process.env.SERPER_API_KEY;

  if (!apiKey) {
    console.warn("[Search] SERPER_API_KEY not configured, skipping web search");
    return [];
  }

  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: query,
        num: Math.min(num, 10),
      }),
    });

    if (!res.ok) {
      console.warn(`[Search] Serper API error: ${res.status} ${res.statusText}`);
      return [];
    }

    const data: SerperResponse = await res.json();

    return (data.organic || []).map((item) => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet || "",
      displayLink: new URL(item.link).hostname,
    }));
  } catch (err) {
    console.warn(`[Search] Web search failed: ${err}`);
    return [];
  }
}

/**
 * Search restricted to a specific site.
 */
export async function searchGoogleSite(
  query: string,
  site: string,
  num: number = 5
): Promise<SearchResult[]> {
  return searchGoogle(`site:${site} ${query}`, num);
}
