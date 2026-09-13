import { createServiceRoleClient } from "../../supabase/server";
import type { AgentStorageService } from "../types";

export function createAgentStorageService(userAgentId: string): AgentStorageService {
  return {
    async get<T = unknown>(key: string): Promise<T | null> {
      const supabase = await createServiceRoleClient();
      const { data } = await supabase
        .from("agent_storage")
        .select("storage_value, expires_at")
        .eq("user_agent_id", userAgentId)
        .eq("storage_key", key)
        .single();

      if (!data) return null;

      // Check expiry
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        await supabase
          .from("agent_storage")
          .delete()
          .eq("user_agent_id", userAgentId)
          .eq("storage_key", key);
        return null;
      }

      return data.storage_value as T;
    },

    async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
      const supabase = await createServiceRoleClient();
      const expiresAt = ttlSeconds
        ? new Date(Date.now() + ttlSeconds * 1000).toISOString()
        : null;

      await supabase.from("agent_storage").upsert(
        {
          user_agent_id: userAgentId,
          storage_key: key,
          storage_value: value,
          expires_at: expiresAt,
        },
        { onConflict: "user_agent_id,storage_key" }
      );
    },

    async delete(key: string): Promise<void> {
      const supabase = await createServiceRoleClient();
      await supabase
        .from("agent_storage")
        .delete()
        .eq("user_agent_id", userAgentId)
        .eq("storage_key", key);
    },

    async list(prefix?: string): Promise<{ key: string; value: unknown }[]> {
      const supabase = await createServiceRoleClient();
      let query = supabase
        .from("agent_storage")
        .select("storage_key, storage_value")
        .eq("user_agent_id", userAgentId);

      if (prefix) {
        query = query.like("storage_key", `${prefix}%`);
      }

      const { data } = await query;
      return (data || []).map((d) => ({
        key: d.storage_key,
        value: d.storage_value,
      }));
    },
  };
}
