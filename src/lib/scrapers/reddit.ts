export interface RedditProfile {
  username: string;
  karma: number;
  subreddits: string[];
  top_comments: { subreddit: string; body: string; score: number }[];
  interests: string[];
  note?: string;
}

/**
 * Reddit blocks unauthenticated server-side requests (403).
 * We attempt the public JSON API first, and if blocked, return a
 * partial profile with the username so the character builder can
 * still reference the user's Reddit presence.
 */
export async function scrapeReddit(username: string): Promise<RedditProfile> {
  const cleanUsername = username.replace(/^\/?u\//, "").replace(/^https?:\/\/(www\.)?reddit\.com\/user\//, "").trim();

  const headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "application/json",
  };

  try {
    const aboutRes = await fetch(`https://www.reddit.com/user/${cleanUsername}/about.json`, { headers });

    if (!aboutRes.ok) {
      return {
        username: cleanUsername,
        karma: 0,
        subreddits: [],
        top_comments: [],
        interests: [],
        note: `Reddit profile linked: u/${cleanUsername}. Reddit's API blocked server-side access (HTTP ${aboutRes.status}). The username is saved and will be used for context in content curation.`,
      };
    }

    const about = await aboutRes.json();

    const commentsRes = await fetch(
      `https://www.reddit.com/user/${cleanUsername}/comments.json?limit=25&sort=top`,
      { headers }
    );
    const commentsData = commentsRes.ok ? await commentsRes.json() : { data: { children: [] } };

    const subredditSet = new Set<string>();
    const topComments: { subreddit: string; body: string; score: number }[] = [];

    for (const child of commentsData.data?.children || []) {
      const comment = child.data;
      subredditSet.add(comment.subreddit);
      if (topComments.length < 5) {
        topComments.push({
          subreddit: comment.subreddit,
          body: comment.body?.slice(0, 200) || "",
          score: comment.score,
        });
      }
    }

    const techSubreddits = [
      "programming", "webdev", "javascript", "python", "golang", "rust",
      "devops", "kubernetes", "docker", "aws", "systemdesign", "leetcode",
      "cscareerquestions", "experienceddevs", "softwareengineering",
    ];
    const interests = Array.from(subredditSet).filter((s) =>
      techSubreddits.some((ts) => s.toLowerCase().includes(ts))
    );

    return {
      username: cleanUsername,
      karma: about.data?.total_karma || 0,
      subreddits: Array.from(subredditSet),
      top_comments: topComments,
      interests,
    };
  } catch {
    return {
      username: cleanUsername,
      karma: 0,
      subreddits: [],
      top_comments: [],
      interests: [],
      note: `Reddit profile linked: u/${cleanUsername}. Could not scrape due to API restrictions. The username is saved for context.`,
    };
  }
}
