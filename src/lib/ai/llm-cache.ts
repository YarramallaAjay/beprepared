import { createServiceRoleClient } from "../supabase/server";
import type { AIFeature } from "./model-config";
import type { LLMMessage } from "./llm-client";

const CACHE_TTLS: Partial<Record<AIFeature, number>> = {
  interview_questions: 7 * 24 * 3600,   // 7 days
  content_curation: 24 * 3600,           // 24 hours
  character_building: 24 * 3600,         // 24 hours
  daily_plan: 12 * 3600,                 // 12 hours
};

// Features that should NOT be cached
const UNCACHEABLE: AIFeature[] = ["adaptive_followup", "whatsapp_parsing"];

/**
 * Generate a cache key from feature + messages using SHA-256.
 */
async function generateCacheKey(
  feature: AIFeature,
  messages: LLMMessage[]
): Promise<string> {
  const input = JSON.stringify({ feature, messages });
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Look up a cached LLM response.
 */
export async function getCachedResponse(
  feature: AIFeature,
  messages: LLMMessage[]
): Promise<string | null> {
  if (UNCACHEABLE.includes(feature)) return null;

  try {
    const cacheKey = await generateCacheKey(feature, messages);
    const supabase = await createServiceRoleClient();

    const { data } = await supabase
      .from("llm_cache")
      .select("response")
      .eq("cache_key", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (data) {
      console.log(`[LLM Cache] HIT for ${feature}`);
      return data.response;
    }
  } catch {
    // Cache miss or DB error - not critical
  }

  return null;
}

/**
 * Store an LLM response in the cache.
 */
export async function setCachedResponse(
  feature: AIFeature,
  messages: LLMMessage[],
  response: string
): Promise<void> {
  const ttl = CACHE_TTLS[feature];
  if (!ttl || UNCACHEABLE.includes(feature)) return;

  try {
    const cacheKey = await generateCacheKey(feature, messages);
    const supabase = await createServiceRoleClient();
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

    await supabase.from("llm_cache").upsert(
      {
        cache_key: cacheKey,
        feature,
        response,
        expires_at: expiresAt,
      },
      { onConflict: "cache_key" }
    );

    console.log(`[LLM Cache] STORED for ${feature} (TTL: ${ttl}s)`);
  } catch (err) {
    console.warn(`[LLM Cache] Failed to store: ${err}`);
  }
}
