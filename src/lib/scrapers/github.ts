export interface GitHubProfile {
  name: string;
  bio: string;
  company: string;
  location: string;
  public_repos: number;
  followers: number;
  top_languages: string[];
  top_repos: { name: string; description: string; language: string; stars: number; url: string }[];
  topics: string[];
  recent_activity: string[];
}

export async function scrapeGitHub(username: string): Promise<GitHubProfile> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "STFU-BePrepared-App",
  };

  // Fetch user profile
  const userRes = await fetch(`https://api.github.com/users/${username}`, { headers });
  if (!userRes.ok) throw new Error(`GitHub user not found: ${username}`);
  const user = await userRes.json();

  // Fetch repos sorted by stars
  const reposRes = await fetch(
    `https://api.github.com/users/${username}/repos?sort=stars&per_page=10&direction=desc`,
    { headers }
  );
  const repos = reposRes.ok ? await reposRes.json() : [];

  // Extract languages from repos
  const languageCounts: Record<string, number> = {};
  const topics = new Set<string>();
  const topRepos = [];

  for (const repo of repos) {
    if (repo.language) {
      languageCounts[repo.language] = (languageCounts[repo.language] || 0) + 1;
    }
    if (repo.topics) {
      repo.topics.forEach((t: string) => topics.add(t));
    }
    topRepos.push({
      name: repo.name,
      description: repo.description || "",
      language: repo.language || "Unknown",
      stars: repo.stargazers_count,
      url: repo.html_url,
    });
  }

  const topLanguages = Object.entries(languageCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([lang]) => lang);

  // Fetch recent events
  const eventsRes = await fetch(
    `https://api.github.com/users/${username}/events/public?per_page=10`,
    { headers }
  );
  const events = eventsRes.ok ? await eventsRes.json() : [];
  const recentActivity = events
    .slice(0, 5)
    .map((e: { type: string; repo: { name: string }; created_at: string }) => `${e.type} on ${e.repo.name} (${e.created_at})`);

  return {
    name: user.name || username,
    bio: user.bio || "",
    company: user.company || "",
    location: user.location || "",
    public_repos: user.public_repos,
    followers: user.followers,
    top_languages: topLanguages,
    top_repos: topRepos,
    topics: Array.from(topics),
    recent_activity: recentActivity,
  };
}
