import { searchGoogle } from "../../search/google-search";
import { searchYouTube } from "../../search/youtube-search";
import type { AgentToolService } from "../types";

export function createAgentToolService(): AgentToolService {
  return {
    async searchWeb(query: string, limit: number = 5) {
      const results = await searchGoogle(query, limit);
      return results.map((r) => ({
        title: r.title,
        url: r.link,
        snippet: r.snippet,
      }));
    },

    async searchYouTube(query: string, limit: number = 5) {
      const results = await searchYouTube(query, limit);
      return results.map((r) => ({
        title: r.title,
        url: r.url,
        description: r.description,
        author: r.author,
        duration: r.duration,
      }));
    },

    async callMCP(_serverName: string, _toolName: string, _params: Record<string, unknown>) {
      // Basic MCP support - to be implemented in Phase 3
      throw new Error("MCP support not yet available. Coming in a future update.");
    },
  };
}
