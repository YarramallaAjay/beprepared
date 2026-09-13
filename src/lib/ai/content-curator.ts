import { callLLMJson } from "./llm-client";
import { CONTENT_CURATION_SYSTEM } from "./prompts";
import { resolvePerson } from "../sources/person-resolver";
import {
  searchResources,
  type ResourceSearchResult,
} from "../search/search-engine";

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

/**
 * Two-phase content curation:
 * Phase 1: Search for real resources (no LLM)
 * Phase 2: LLM curates and organizes the real resources
 */
export async function curateContent(
  profile: UserProfile,
  characterDoc: string | null,
  preferredSources: SourcePref[],
  people: string[],
  userId?: string
): Promise<CurationResult> {
  // === PHASE 1: Search for real resources ===

  // Resolve people sequentially to avoid overwhelming search APIs
  const resolvedPeople = [];
  for (const name of people) {
    try {
      const person = await resolvePerson(name);
      resolvedPeople.push(person);
    } catch (err) {
      console.warn(`[Curation] Failed to resolve person "${name}": ${err}`);
    }
  }

  // Search for resources based on tech targets and learning areas
  const searchQueries: string[] = [];

  if (profile.tech_targets?.length) {
    for (const target of profile.tech_targets) {
      searchQueries.push(`${target} tutorial`);
      searchQueries.push(`${target} best practices ${profile.experience_years || 3}+ years`);
    }
  }

  if (profile.target_role) {
    searchQueries.push(`${profile.target_role} interview preparation`);
    searchQueries.push(`${profile.target_role} learning roadmap`);
  }

  if (profile.weaknesses?.length) {
    for (const weakness of profile.weaknesses.slice(0, 3)) {
      searchQueries.push(`${weakness} software engineering guide`);
    }
  }

  // Run searches in parallel (batched to avoid rate limits)
  const allResources: ResourceSearchResult[] = [];
  const BATCH_SIZE = 3;
  for (let i = 0; i < searchQueries.length; i += BATCH_SIZE) {
    const batch = searchQueries.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((q) => searchResources(q, ["web", "youtube"], 5))
    );
    allResources.push(...results.flat());
  }

  // Also search for each person's content
  for (const person of resolvedPeople) {
    if (person.platforms.youtube) {
      try {
        const videos = await searchResources(
          `${person.name} ${profile.tech_targets?.[0] || "engineering"}`,
          ["youtube"],
          3
        );
        allResources.push(...videos);
      } catch {
        // Skip if search fails
      }
    }
  }

  // Deduplicate resources by URL
  const seen = new Set<string>();
  const uniqueResources = allResources.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  // === PHASE 2: LLM curates and organizes ===

  const sourcesStr = preferredSources
    .map((s, i) => `${i + 1}. [${s.source_type}] ${s.source_name}${s.source_url ? ` (${s.source_url})` : ""}`)
    .join("\n");

  const peopleStr = resolvedPeople
    .map(
      (p) =>
        `- ${p.name}: ${p.description}\n  Platforms: ${JSON.stringify(p.platforms)}\n  Topics: ${p.topics.join(", ")}`
    )
    .join("\n");

  const resourcesStr = uniqueResources
    .slice(0, 100) // Cap at 100 resources
    .map(
      (r, i) =>
        `${i + 1}. [${r.source}] "${r.title}" - ${r.url}${r.author ? ` (by ${r.author})` : ""}${r.duration ? ` [${r.duration}]` : ""}\n   ${r.snippet.slice(0, 150)}`
    )
    .join("\n");

  const profileStr = JSON.stringify(profile, null, 2);

  return callLLMJson("content_curation", [
    { role: "system", content: CONTENT_CURATION_SYSTEM },
    {
      role: "user",
      content: `Create a personalized learning roadmap for this engineer.

## User Profile
${profileStr}

${characterDoc ? `## Character Document\n${characterDoc}\n` : ""}

## People to Prioritize Content From
${peopleStr || "None specified"}

## Preferred Sources (in priority order)
${sourcesStr || "Use default sources"}

## VERIFIED RESOURCES (real URLs from search — use ONLY these)
${resourcesStr || "No search results available — use well-known source URLs only"}

## Requirements
- Daily available time: ${profile.daily_hours_available || 2} hours
- Create a ${Math.ceil((profile.tech_targets?.length || 3) * 2)}-week roadmap
- Include 5-8 items per week
- **CRITICAL: Only use URLs from the VERIFIED RESOURCES list above.** Do not invent or guess URLs.
- PRIORITIZE content from the listed people and sources
- Mix: 30% blogs, 30% videos, 20% courses/practice, 20% repos/docs
- Tag each item with source_origin (which person/source it came from)

Return JSON: {
  "items": [{ "title": string, "url": string, "content_type": string, "topic": string, "description": string, "estimated_minutes": number, "priority": number (1-5), "source_origin": string, "week_number": number }],
  "roadmap_summary": string,
  "total_weeks": number
}`,
    },
  ], { userId });
}
