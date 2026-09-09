import { callLLM } from "../ai/llm-client";
import { CHARACTER_BUILDING_SYSTEM } from "../ai/prompts";

export interface SocialData {
  github?: unknown;
  reddit?: unknown;
  linkedin?: unknown;
  twitter?: unknown;
}

export interface ProfileContext {
  current_role?: string;
  target_role?: string;
  experience_years?: number;
  tech_stack?: string[];
  strengths?: string[];
  weaknesses?: string[];
  domain_experience?: string[];
  tech_targets?: string[];
}

export async function buildCharacterDocument(
  socialData: SocialData,
  interviewAnswers?: Record<string, string>,
  existingCharacter?: string,
  profileContext?: ProfileContext
): Promise<string> {
  const dataStr = JSON.stringify(socialData, null, 2);

  // Build profile context block (highest priority for identity/employment)
  let profileBlock = "";
  if (profileContext) {
    const parts: string[] = [];
    if (profileContext.current_role) parts.push(`Current Role: ${profileContext.current_role}`);
    if (profileContext.target_role) parts.push(`Target Role: ${profileContext.target_role}`);
    if (profileContext.experience_years) parts.push(`Years of Experience: ${profileContext.experience_years}`);
    if (profileContext.tech_stack?.length) parts.push(`Tech Stack: ${profileContext.tech_stack.join(", ")}`);
    if (profileContext.strengths?.length) parts.push(`Strengths: ${profileContext.strengths.join(", ")}`);
    if (profileContext.weaknesses?.length) parts.push(`Weaknesses: ${profileContext.weaknesses.join(", ")}`);
    if (profileContext.domain_experience?.length) parts.push(`Domain Experience: ${profileContext.domain_experience.join(", ")}`);
    if (profileContext.tech_targets?.length) parts.push(`Tech Targets: ${profileContext.tech_targets.join(", ")}`);
    if (parts.length > 0) {
      profileBlock = `ONBOARDING PROFILE (PRIMARY SOURCE for identity & employment — this is what the user explicitly told us):\n${parts.join("\n")}\n\n`;
    }
  }

  const interviewBlock = interviewAnswers
    ? `Interview answers:\n${JSON.stringify(interviewAnswers, null, 2)}\n\n`
    : "";

  const prompt = existingCharacter
    ? `Here is the user's existing character profile:\n\n${existingCharacter}\n\n${profileBlock}Here is NEW social data:\n${dataStr}\n\n${interviewBlock}IMPORTANT: For "Identity & Background", use the onboarding profile data (current role, target role, experience) as the PRIMARY source. LinkedIn data can corroborate. GitHub bio/description is supplementary — do NOT use it as the main source for current employment.\n\nUpdate the character profile with any new insights. Only change sections where the new data reveals something different. Add a "## Latest Changes" section at the top noting what changed and why.`
    : `${profileBlock}Social data:\n${dataStr}\n\n${interviewBlock}IMPORTANT: For "Identity & Background", use the onboarding profile data (current role, target role, experience) as the PRIMARY source of truth for who they are professionally. Cross-reference with LinkedIn data if available. GitHub bio/description is supplementary context — do NOT treat it as the authoritative source for current employment or role.\n\nGenerate a comprehensive character profile in markdown format with these sections:
# User Character Profile
## Identity & Background
## Technical DNA
## Interests & Curiosities
## Learning Style
## Blind Spots
## Growth Trajectory
## Content Preferences

Be specific, cite evidence from their data, and be honest about gaps.`;

  return callLLM(
    "character_building",
    [
      { role: "system", content: CHARACTER_BUILDING_SYSTEM },
      { role: "user", content: prompt },
    ],
    { temperature: 0.6, max_tokens: 2048 }
  );
}
