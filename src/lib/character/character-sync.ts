import { createServiceRoleClient } from "../supabase/server";
import { scrapeGitHub } from "../scrapers/github";
import { scrapeReddit } from "../scrapers/reddit";
import { scrapeLinkedIn } from "../scrapers/linkedin";
import { scrapeTwitter } from "../scrapers/twitter";
import { buildCharacterDocument, SocialData } from "./character-builder";

type ScraperFn = (input: string) => Promise<unknown>;

const scrapers: Record<string, ScraperFn> = {
  github: scrapeGitHub,
  reddit: scrapeReddit,
  linkedin: scrapeLinkedIn,
  twitter: scrapeTwitter,
};

export async function syncCharacter(userId: string): Promise<string> {
  const supabase = await createServiceRoleClient();

  // Fetch social profiles (may be empty if user skipped the connect step)
  const { data: socialProfiles } = await supabase
    .from("social_profiles")
    .select("*")
    .eq("user_id", userId);

  // Scrape all platforms
  const socialData: SocialData = {};
  if (socialProfiles && socialProfiles.length > 0) {
    for (const profile of socialProfiles) {
      const scraper = scrapers[profile.platform];
      if (!scraper) continue;

      try {
        const data = await scraper(profile.username_or_url);
        socialData[profile.platform as keyof SocialData] = data;

        // Update scraped data and sync timestamp
        await supabase
          .from("social_profiles")
          .update({
            scraped_data: data,
            last_synced_at: new Date().toISOString(),
          })
          .eq("id", profile.id);
      } catch (err) {
        console.warn(`Failed to scrape ${profile.platform}: ${err}`);
      }
    }
  }

  // Get full profile data (current role, target role, experience, interview answers)
  const { data: userProfile } = await supabase
    .from("profiles")
    .select("current_role, target_role, experience_years, tech_stack, strengths, weaknesses, domain_experience, tech_targets, interview_answers")
    .eq("id", userId)
    .single();

  // Get existing character doc
  const { data: existingDoc } = await supabase
    .from("character_documents")
    .select("content_md, version")
    .eq("user_id", userId)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  // Build or update character with full profile context
  const profileContext = userProfile
    ? {
        current_role: userProfile.current_role,
        target_role: userProfile.target_role,
        experience_years: userProfile.experience_years,
        tech_stack: userProfile.tech_stack,
        strengths: userProfile.strengths,
        weaknesses: userProfile.weaknesses,
        domain_experience: userProfile.domain_experience,
        tech_targets: userProfile.tech_targets,
      }
    : undefined;

  const characterMd = await buildCharacterDocument(
    socialData,
    userProfile?.interview_answers,
    existingDoc?.content_md,
    profileContext
  );

  // Save character document
  const newVersion = (existingDoc?.version || 0) + 1;
  await supabase.from("character_documents").insert({
    user_id: userId,
    content_md: characterMd,
    version: newVersion,
    change_log: existingDoc ? "Auto-sync update" : "Initial character build",
  });

  return characterMd;
}
