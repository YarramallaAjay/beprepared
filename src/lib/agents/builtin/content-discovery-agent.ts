import type { AgentDefinition, AgentContext, DataView, RecommendationItem } from "../types";
import { registerAgent } from "../registry";

interface CuratedItem {
  title: string;
  url: string;
  content_type: string;
  topic: string;
  description: string;
  estimated_minutes: number;
  priority: number;
  source_origin: string;
  week_number: number;
}

interface CurationOutput {
  items: CuratedItem[];
  roadmap_summary: string;
  total_weeks: number;
}

const CURATION_SYSTEM_PROMPT = `You are an expert technical content curator. Your job is to recommend the best learning resources for a software engineer.

IMPORTANT RULES:
1. ONLY use URLs from the VERIFIED RESOURCES list provided
2. Do NOT invent or guess URLs
3. Organize content into a week-by-week roadmap
4. Mix content types: blogs, videos, courses, repos, documentation
5. Return valid JSON`;

const contentDiscoveryAgent: AgentDefinition = {
  identity: {
    slug: "content-discovery",
    name: "Content Discovery",
    description: "Searches the web for real learning resources matched to your profile and creates a personalized roadmap with verified URLs.",
    version: "1.0.0",
    author: "system",
    category: "builtin",
    icon: "Search",
    color: "blue",
  },

  configFields: [
    { key: "roadmap_weeks", label: "Roadmap duration (weeks)", type: "number", default: 6, validation: { min: 1, max: 24 } },
    { key: "items_per_week", label: "Items per week", type: "number", default: 7, validation: { min: 3, max: 15 } },
    {
      key: "content_mix",
      label: "Content type focus",
      type: "select",
      options: [
        { label: "Balanced", value: "balanced" },
        { label: "Videos heavy", value: "videos" },
        { label: "Reading heavy", value: "reading" },
        { label: "Practice heavy", value: "practice" },
      ],
      default: "balanced",
    },
  ],

  permissions: [
    { resource: "profiles", actions: ["read"] },
    { resource: "character_documents", actions: ["read"] },
    { resource: "preferred_sources", actions: ["read"] },
    { resource: "content_items", actions: ["read", "write", "delete"] },
  ],

  tools: [
    { name: "web_search", required: true },
    { name: "youtube_search", required: true },
  ],

  mcpConnections: [],
  dataViewType: "recommendations",
  defaultExecutionMode: "on_demand",

  async validate(config) {
    const weeks = config.roadmap_weeks as number;
    if (weeks && (weeks < 1 || weeks > 24)) {
      return { valid: false, errors: ["roadmap_weeks must be between 1 and 24"] };
    }
    return { valid: true };
  },

  async execute(ctx: AgentContext): Promise<Record<string, unknown>> {
    const profile = await ctx.db.getProfile();
    const characterDoc = await ctx.db.getCharacterDoc();
    const sources = await ctx.db.getPreferredSources();

    if (!profile) throw new Error("Profile not found. Complete onboarding first.");

    const techTargets = (profile.tech_targets as string[]) || [];
    const weaknesses = (profile.weaknesses as string[]) || [];
    const targetRole = profile.target_role as string;

    // Phase 1: Search for real resources
    const allResources: { title: string; url: string; snippet: string; source: string; author?: string; duration?: string }[] = [];

    // Search for each tech target
    for (const target of techTargets) {
      const [webResults, ytResults] = await Promise.all([
        ctx.tools.searchWeb(`${target} tutorial guide`, 5),
        ctx.tools.searchYouTube(`${target} tutorial`, 3),
      ]);

      allResources.push(
        ...webResults.map((r) => ({ ...r, source: "web" })),
        ...ytResults.map((r) => ({ title: r.title, url: r.url, snippet: r.description, source: "youtube", author: r.author, duration: r.duration }))
      );
    }

    // Search for target role prep
    if (targetRole) {
      const [webResults, ytResults] = await Promise.all([
        ctx.tools.searchWeb(`${targetRole} interview preparation`, 5),
        ctx.tools.searchYouTube(`${targetRole} roadmap`, 3),
      ]);
      allResources.push(
        ...webResults.map((r) => ({ ...r, source: "web" })),
        ...ytResults.map((r) => ({ title: r.title, url: r.url, snippet: r.description, source: "youtube", author: r.author, duration: r.duration }))
      );
    }

    // Search for weakness areas
    for (const weakness of weaknesses.slice(0, 3)) {
      const results = await ctx.tools.searchWeb(`${weakness} software engineering guide`, 3);
      allResources.push(...results.map((r) => ({ ...r, source: "web" })));
    }

    // Deduplicate by URL
    const seen = new Set<string>();
    const uniqueResources = allResources.filter((r) => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });

    // Phase 2: LLM curates and organizes
    const resourcesStr = uniqueResources
      .slice(0, 80)
      .map(
        (r, i) =>
          `${i + 1}. [${r.source}] "${r.title}" - ${r.url}${r.author ? ` (by ${r.author})` : ""}${r.duration ? ` [${r.duration}]` : ""}\n   ${r.snippet.slice(0, 120)}`
      )
      .join("\n");

    const sourcesStr = sources
      .map((s, i) => `${i + 1}. [${s.source_type}] ${s.source_name}`)
      .join("\n");

    const weeks = (ctx.userConfig.roadmap_weeks as number) || 6;
    const itemsPerWeek = (ctx.userConfig.items_per_week as number) || 7;

    const result = await ctx.llm.chatJson<CurationOutput>(
      [
        { role: "system", content: CURATION_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Create a ${weeks}-week learning roadmap with ${itemsPerWeek} items per week.

## User Profile
${JSON.stringify(profile, null, 2)}

${characterDoc ? `## Character\n${characterDoc.slice(0, 500)}\n` : ""}

## Preferred Sources
${sourcesStr || "Use default sources"}

## VERIFIED RESOURCES (use ONLY these URLs)
${resourcesStr || "No search results. Use well-known URLs only."}

Return JSON: {
  "items": [{ "title": string, "url": string, "content_type": string, "topic": string, "description": string, "estimated_minutes": number, "priority": number (1-5), "source_origin": string, "week_number": number }],
  "roadmap_summary": string,
  "total_weeks": number
}`,
        },
      ]
    );

    return result as unknown as Record<string, unknown>;
  },

  async render(data: Record<string, unknown>): Promise<DataView<"recommendations">> {
    const output = data as unknown as CurationOutput;

    const items: RecommendationItem[] = (output.items || []).map((item, i) => ({
      id: `item-${i}`,
      title: item.title,
      description: item.description,
      url: item.url,
      content_type: item.content_type,
      estimated_minutes: item.estimated_minutes,
      priority: item.priority,
      source: item.source_origin,
      tags: [item.topic, `Week ${item.week_number}`],
    }));

    return {
      type: "recommendations",
      title: "Learning Roadmap",
      subtitle: `${output.total_weeks}-week plan — ${items.length} resources`,
      data: {
        items,
        summary: output.roadmap_summary,
      },
      actions: [
        { label: "Re-discover", type: "primary", handler: "refresh" },
      ],
      empty_state: {
        title: "No content discovered yet",
        description: "Run the agent to search for learning resources matched to your profile.",
        action: { label: "Discover Content", type: "primary", handler: "refresh" },
      },
      updated_at: new Date().toISOString(),
    };
  },
};

registerAgent(contentDiscoveryAgent);
