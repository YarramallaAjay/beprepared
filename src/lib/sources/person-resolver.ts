import { callLLMJson } from "../ai/llm-client";

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
 * Resolve a person's name to their content across platforms.
 * Uses LLM knowledge to find known tech content creators.
 */
export async function resolvePerson(name: string): Promise<ResolvedPerson> {
  return callLLMJson("content_curation", [
    {
      role: "system",
      content: `You are a tech content researcher. Given a person's name, find their known online presence across platforms. Only include platforms where they are KNOWN to have content. Return valid JSON.`,
    },
    {
      role: "user",
      content: `Find the online presence of "${name}" in the tech/engineering space.

Return JSON: {
  "name": "${name}",
  "platforms": {
    "youtube": "channel URL or null",
    "blog": "blog URL or null",
    "github": "profile URL or null",
    "twitter": "handle or null",
    "linkedin": "profile URL or null",
    "website": "personal site URL or null"
  },
  "topics": ["list of topics they cover"],
  "description": "brief description of who they are and what they're known for"
}

Only include real, verified URLs. If you're not sure about a platform, set it to null.`,
    },
  ]);
}
