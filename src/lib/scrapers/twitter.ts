export interface TwitterProfile {
  handle: string;
  note: string;
  manual_data?: {
    bio?: string;
    interests?: string[];
    tech_people_followed?: string[];
  };
}

/**
 * X/Twitter API requires paid access ($100/mo minimum).
 * We store the handle and allow manual input of key data.
 * The character builder will work with whatever data is available.
 */
export async function scrapeTwitter(handle: string): Promise<TwitterProfile> {
  const cleanHandle = handle.replace("@", "").replace("https://x.com/", "").replace("https://twitter.com/", "");

  return {
    handle: cleanHandle,
    note: `X/Twitter profile linked: @${cleanHandle}. Due to API restrictions, please manually add your bio, tech interests, and notable people you follow. This helps us find content from people in your network.`,
  };
}
