import { callLLMJson } from "./llm-client";
import { CONTENT_CURATION_SYSTEM } from "./prompts";
import { resolvePerson } from "../sources/person-resolver";

export interface CuratedItem {
  title: string;
  url: string;
  content_type: "blog" | "video" | "course" | "repo" | "documentation" | "practice" | "other";
  topic: string;
  description: string;
  estimated_minutes: number;
  priority: number;
  source_origin: string;
  week_number: number;
}

export interface CurationResult {
  items: CuratedItem[];
  roadmap_summary: string;
  total_weeks: number;
}

interface UserProfile {
  target_role?: string;
  current_role?: string;
  experience_years?: number;
  tech_stack?: string[];
  strengths?: string[];
  weaknesses?: string[];
  domain_experience?: string[];
  tech_targets?: string[];
  daily_hours_available?: number;
}

interface SourcePref {
  source_name: string;
  source_type: string;
  source_url?: string;
}

export async function curateContent(
  profile: UserProfile,
  characterDoc: string | null,
  preferredSources: SourcePref[],
  people: string[]
): Promise<CurationResult> {
  // Resolve people to their platforms
  const resolvedPeople = await Promise.allSettled(
    people.map((name) => resolvePerson(name))
  );
  const personData = resolvedPeople
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<Awaited<ReturnType<typeof resolvePerson>>>).value);

  const sourcesStr = preferredSources
    .map((s, i) => `${i + 1}. [${s.source_type}] ${s.source_name}${s.source_url ? ` (${s.source_url})` : ""}`)
    .join("\n");

  const peopleStr = personData
    .map(
      (p) =>
        `- ${p.name}: ${p.description}\n  Platforms: ${JSON.stringify(p.platforms)}\n  Topics: ${p.topics.join(", ")}`
    )
    .join("\n");

  const profileStr = JSON.stringify(profile, null, 2);

  return callLLMJson("content_curation", [
    { role: "system", content: CONTENT_CURATION_SYSTEM },
    {
      role: "user",
      content: `Create a personalized learning roadmap for this engineer:

## User Profile
${profileStr}

${characterDoc ? `## Character Document\n${characterDoc}\n` : ""}

## People to Prioritize Content From
${peopleStr || "None specified"}

## Preferred Sources (in priority order)
${sourcesStr || "Use default sources"}

## Requirements
- Daily available time: ${profile.daily_hours_available || 2} hours
- Create a ${Math.ceil((profile.tech_targets?.length || 3) * 2)}-week roadmap
- Include 5-8 items per week
- PRIORITIZE content from the listed people and sources
- Mix: 30% blogs, 30% videos, 20% courses/practice, 20% repos/docs
- Tag each item with source_origin (which person/source it came from)

Return JSON: {
  "items": [{ "title": string, "url": string, "content_type": string, "topic": string, "description": string, "estimated_minutes": number, "priority": number (1-5), "source_origin": string, "week_number": number }],
  "roadmap_summary": string,
  "total_weeks": number
}`,
    },
  ]);
}
