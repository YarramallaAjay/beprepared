import { createServiceRoleClient } from "../supabase/server";

interface CachedContext {
  text: string;
  timestamp: number;
}

const contextCache = new Map<string, CachedContext>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Build a comprehensive user context block from all DB sources.
 * This block is prepended to every LLM call's system prompt so every model
 * has the same understanding of the user.
 */
export async function buildUserContext(userId: string): Promise<string> {
  // Check in-memory cache
  const cached = contextCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.text;
  }

  const supabase = await createServiceRoleClient();

  // Parallel DB queries
  const [profileResult, characterResult, progressResult, sourcesResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "current_role, target_role, experience_years, tech_stack, strengths, weaknesses, tech_targets, daily_hours_available, preferred_learning_time"
        )
        .eq("id", userId)
        .single(),
      supabase
        .from("character_documents")
        .select("content_md")
        .eq("user_id", userId)
        .order("version", { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from("content_items")
        .select("status")
        .eq("user_id", userId),
      supabase
        .from("preferred_sources")
        .select("source_name, source_type")
        .eq("user_id", userId)
        .order("priority_rank", { ascending: true })
        .limit(10),
    ]);

  const profile = profileResult.data;
  const character = characterResult.data;
  const items = progressResult.data || [];
  const sources = sourcesResult.data || [];

  const parts: string[] = ["--- USER CONTEXT ---"];

  // Profile section
  if (profile) {
    const profileLines: string[] = [];
    if (profile.current_role) profileLines.push(`Current Role: ${profile.current_role}`);
    if (profile.target_role) profileLines.push(`Target Role: ${profile.target_role}`);
    if (profile.experience_years) profileLines.push(`Experience: ${profile.experience_years} years`);
    if (profile.tech_stack?.length) profileLines.push(`Tech Stack: ${profile.tech_stack.join(", ")}`);
    if (profile.strengths?.length) profileLines.push(`Strengths: ${profile.strengths.join(", ")}`);
    if (profile.weaknesses?.length) profileLines.push(`Weaknesses: ${profile.weaknesses.join(", ")}`);
    if (profile.tech_targets?.length) profileLines.push(`Learning Targets: ${profile.tech_targets.join(", ")}`);
    if (profile.preferred_learning_time) profileLines.push(`Preferred Time: ${profile.preferred_learning_time}`);
    if (profile.daily_hours_available) profileLines.push(`Daily Hours: ${profile.daily_hours_available}`);
    if (profileLines.length > 0) {
      parts.push(`## Profile\n${profileLines.join("\n")}`);
    }
  }

  // Character summary (first ~600 chars)
  if (character?.content_md) {
    const summary = character.content_md.slice(0, 600);
    const truncated = summary.length < character.content_md.length ? summary + "..." : summary;
    parts.push(`## Character Summary\n${truncated}`);
  }

  // Progress
  if (items.length > 0) {
    const total = items.length;
    const completed = items.filter((i) => i.status === "completed").length;
    const pending = items.filter((i) => i.status === "pending").length;
    parts.push(
      `## Progress\nTotal Items: ${total} | Completed: ${completed} | Pending: ${pending}`
    );
  }

  // Preferred sources
  if (sources.length > 0) {
    const sourceList = sources
      .map((s) => `- [${s.source_type}] ${s.source_name}`)
      .join("\n");
    parts.push(`## Preferred Sources\n${sourceList}`);
  }

  parts.push("--- END USER CONTEXT ---");

  const text = parts.join("\n\n");

  // Cache it
  contextCache.set(userId, { text, timestamp: Date.now() });

  return text;
}

/**
 * Invalidate the cached user context after profile updates, character syncs, etc.
 */
export function invalidateUserContext(userId: string): void {
  contextCache.delete(userId);
}
