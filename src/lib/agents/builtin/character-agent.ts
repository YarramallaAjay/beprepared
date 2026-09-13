import type { AgentDefinition, AgentContext, DataView } from "../types";
import { registerAgent } from "../registry";
import { createServiceRoleClient } from "../../supabase/server";

const CHARACTER_SYSTEM_PROMPT = `You are an expert career analyst. Analyze the user's onboarding profile, social media data, and interview answers to build a comprehensive character profile.

DATA PRIORITY ORDER (most authoritative first):
1. ONBOARDING PROFILE — current role, target role, experience years, strengths, weaknesses
2. LINKEDIN — professional context, employment history, endorsements
3. INTERVIEW ANSWERS — behavioral traits, learning preferences, instincts
4. GITHUB — technical DNA, languages, project patterns
5. REDDIT/TWITTER — interests, community engagement

The character profile should include:
1. Identity & Background
2. Technical DNA
3. Interests & Curiosities
4. Learning Style
5. Blind Spots
6. Growth Trajectory
7. Content Preferences

Be specific, cite evidence from their data, and be honest about gaps.`;

interface CharacterOutput {
  content_md: string;
  version: number;
}

const characterAgent: AgentDefinition = {
  identity: {
    slug: "character",
    name: "Character Profile",
    description:
      "Builds a comprehensive profile from your social data, interview answers, and preferences. Used by other agents to personalize content.",
    version: "1.0.0",
    author: "system",
    category: "builtin",
    icon: "User",
    color: "purple",
  },

  configFields: [
    {
      key: "auto_sync",
      label: "Auto-sync weekly",
      type: "boolean",
      default: true,
      description: "Automatically refresh your profile weekly from social data",
    },
  ],

  permissions: [
    { resource: "profiles", actions: ["read"] },
    { resource: "social_profiles", actions: ["read", "write"] },
    { resource: "character_documents", actions: ["read", "write"] },
  ],

  tools: [],
  mcpConnections: [],
  dataViewType: "document",
  defaultExecutionMode: "on_demand",
  defaultSchedule: "0 3 * * 0",

  async validate() {
    return { valid: true };
  },

  async execute(ctx: AgentContext): Promise<Record<string, unknown>> {
    const profile = await ctx.db.getProfile();
    const existingDoc = await ctx.db.getCharacterDoc();

    // Get social profiles
    const socialProfiles = await ctx.db.query("social_profiles", {});

    // Build profile context
    const profileParts: string[] = [];
    if (profile) {
      if (profile.current_role) profileParts.push(`Current Role: ${profile.current_role}`);
      if (profile.target_role) profileParts.push(`Target Role: ${profile.target_role}`);
      if (profile.experience_years) profileParts.push(`Experience: ${profile.experience_years} years`);
      if (Array.isArray(profile.tech_stack) && profile.tech_stack.length)
        profileParts.push(`Tech Stack: ${profile.tech_stack.join(", ")}`);
      if (Array.isArray(profile.strengths) && profile.strengths.length)
        profileParts.push(`Strengths: ${profile.strengths.join(", ")}`);
      if (Array.isArray(profile.weaknesses) && profile.weaknesses.length)
        profileParts.push(`Weaknesses: ${profile.weaknesses.join(", ")}`);
      if (Array.isArray(profile.tech_targets) && profile.tech_targets.length)
        profileParts.push(`Tech Targets: ${profile.tech_targets.join(", ")}`);
    }

    const socialDataStr = JSON.stringify(
      (socialProfiles as Record<string, unknown>[]).map((sp) => ({
        platform: sp.platform,
        data: sp.scraped_data,
      })),
      null,
      2
    );

    const interviewStr = profile?.interview_answers
      ? `Interview Answers:\n${JSON.stringify(profile.interview_answers, null, 2)}`
      : "";

    const userMessage = existingDoc
      ? `Here is the user's existing character profile:\n\n${existingDoc}\n\nONBOARDING PROFILE:\n${profileParts.join("\n")}\n\nSocial data:\n${socialDataStr}\n\n${interviewStr}\n\nUpdate the character profile with any new insights. Add a "## Latest Changes" section at the top.`
      : `ONBOARDING PROFILE:\n${profileParts.join("\n")}\n\nSocial data:\n${socialDataStr}\n\n${interviewStr}\n\nGenerate a comprehensive character profile in markdown.`;

    const contentMd = await ctx.llm.chat(
      [
        { role: "system", content: CHARACTER_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      { temperature: 0.6, max_tokens: 2048 }
    );

    // Get current version and persist the new document
    const existingVersions = await ctx.db.query("character_documents", {});
    const newVersion = existingVersions.length + 1;

    // Persist to character_documents so other agents/services can read it
    const supabase = await createServiceRoleClient();
    await supabase.from("character_documents").insert({
      user_id: ctx.userId,
      content_md: contentMd,
      version: newVersion,
    });

    return { content_md: contentMd, version: newVersion };
  },

  async render(data: Record<string, unknown>): Promise<DataView<"document">> {
    const output = data as unknown as CharacterOutput;
    return {
      type: "document",
      title: "Character Profile",
      subtitle: `Version ${output.version}`,
      data: {
        content_md: output.content_md,
        title: "User Character Profile",
      },
      actions: [
        { label: "Sync Now", type: "primary", handler: "sync" },
      ],
      updated_at: new Date().toISOString(),
    };
  },
};

registerAgent(characterAgent);
