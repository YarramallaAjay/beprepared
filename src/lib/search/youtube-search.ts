import ytSearch from "yt-search";

export interface YouTubeResult {
  title: string;
  videoId: string;
  url: string;
  author: string;
  duration: string;
  views: number;
  description: string;
}

/**
 * Search YouTube using yt-search (no API key needed).
 */
export async function searchYouTube(
  query: string,
  limit: number = 5
): Promise<YouTubeResult[]> {
  try {
    const result = await ytSearch(query);

    return result.videos.slice(0, limit).map((video) => ({
      title: video.title,
      videoId: video.videoId,
      url: video.url,
      author: video.author?.name || "Unknown",
      duration: video.timestamp || "0:00",
      views: video.views || 0,
      description: video.description || "",
    }));
  } catch (err) {
    console.warn(`[Search] YouTube search failed: ${err}`);
    return [];
  }
}
