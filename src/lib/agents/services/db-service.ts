import { createServiceRoleClient } from "../../supabase/server";
import type { AgentDBService } from "../types";

// Tables agents are allowed to read from
const ALLOWED_TABLES = [
  "profiles",
  "social_profiles",
  "character_documents",
  "preferred_sources",
  "content_items",
  "daily_plans",
  "daily_plan_items",
  "reminders",
];

export function createAgentDBService(userId: string): AgentDBService {
  return {
    async getProfile() {
      const supabase = await createServiceRoleClient();
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      return data as Record<string, unknown> | null;
    },

    async getCharacterDoc() {
      const supabase = await createServiceRoleClient();
      const { data } = await supabase
        .from("character_documents")
        .select("content_md")
        .eq("user_id", userId)
        .order("version", { ascending: false })
        .limit(1)
        .single();
      return data?.content_md || null;
    },

    async getPreferredSources() {
      const supabase = await createServiceRoleClient();
      const { data } = await supabase
        .from("preferred_sources")
        .select("source_name, source_type, source_url")
        .eq("user_id", userId)
        .order("priority_rank", { ascending: true });
      return data || [];
    },

    async query(table: string, filters: Record<string, unknown>) {
      if (!ALLOWED_TABLES.includes(table)) {
        throw new Error(`Agent does not have permission to query table: ${table}`);
      }

      const supabase = await createServiceRoleClient();
      let query = supabase.from(table).select("*");

      // Always scope to user
      const userColumn = table === "profiles" ? "id" : "user_id";
      query = query.eq(userColumn, userId);

      // Apply additional filters
      for (const [key, value] of Object.entries(filters)) {
        query = query.eq(key, value);
      }

      const { data } = await query;
      return data || [];
    },
  };
}
