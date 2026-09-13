import { searchGoogle } from "../search/google-search";
import { searchYouTube } from "../search/youtube-search";
import { searchLinkedIn } from "../search/linkedin-search";

export interface ResolvedPerson {
  name: string;
  platforms: {
    youtube?: string;
    blog?: string;
    github?: string;
    twitter?: string;
    linkedin?: string;
    website?: string;
  };
  topics: string[];
  description: string;
}

/**
 * Resolve a person's name to their content across platforms using real search.
 * No LLM call needed — pure search-based resolution.
 */
export async function resolvePerson(name: string): Promise<ResolvedPerson> {
  const [googleResults, youtubeResults, linkedinResults] = await Promise.all([
    searchGoogle(`${name} engineering blog`, 5),
    searchYouTube(name, 3),
    searchLinkedIn(`${name} software engineer`, 3),
  ]);

  const platforms: ResolvedPerson["platforms"] = {};

  // Extract YouTube channel/video
  if (youtubeResults.length > 0) {
    const topVideo = youtubeResults[0];
    // Use the first video's URL — the channel can be derived from author
    platforms.youtube = topVideo.url;
  }

  // Extract LinkedIn profile
  const linkedinProfile = linkedinResults.find(
    (r) => r.link.includes("linkedin.com/in/") || r.link.includes("linkedin.com/pub/")
  );
  if (linkedinProfile) {
    platforms.linkedin = linkedinProfile.link;
  }

  // Extract blog, GitHub, website from Google results
  for (const result of googleResults) {
    const link = result.link.toLowerCase();

    if (!platforms.github && link.includes("github.com/")) {
      platforms.github = result.link;
    } else if (
      !platforms.blog &&
      (link.includes("blog") ||
        link.includes("medium.com") ||
        link.includes("dev.to") ||
        link.includes("hashnode") ||
        link.includes("substack"))
    ) {
      platforms.blog = result.link;
    } else if (!platforms.twitter && (link.includes("twitter.com/") || link.includes("x.com/"))) {
      platforms.twitter = result.link;
    } else if (!platforms.website && !platforms.blog) {
      // If it's a personal domain (not a big platform), treat as website
      const isBigPlatform =
        link.includes("youtube.com") ||
        link.includes("linkedin.com") ||
        link.includes("github.com") ||
        link.includes("twitter.com") ||
        link.includes("x.com") ||
        link.includes("google.com") ||
        link.includes("wikipedia.org");
      if (!isBigPlatform) {
        platforms.website = result.link;
      }
    }
  }

  // Build topics from search snippets
  const allSnippets = [
    ...googleResults.map((r) => r.snippet),
    ...youtubeResults.map((r) => r.description),
  ].join(" ");

  const topicKeywords = [
    "system design", "distributed systems", "databases", "backend",
    "frontend", "react", "node", "python", "go", "rust", "java",
    "kubernetes", "docker", "aws", "cloud", "microservices",
    "machine learning", "ai", "data structures", "algorithms",
    "architecture", "devops", "security", "performance",
  ];

  const topics = topicKeywords.filter((keyword) =>
    allSnippets.toLowerCase().includes(keyword)
  );

  // Build description from top search results
  const description =
    googleResults[0]?.snippet ||
    youtubeResults[0]?.description ||
    `${name} - tech content creator`;

  return {
    name,
    platforms,
    topics: topics.length > 0 ? topics : ["software engineering"],
    description: description.slice(0, 200),
  };
}
