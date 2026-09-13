import { callLLM, callLLMJson } from "../../ai/llm-client";
import type { AgentLLMService } from "../types";

export function createAgentLLMService(userId: string): AgentLLMService {
  return {
    async chat(messages, options) {
      return callLLM("agent_execution", messages, {
        temperature: options?.temperature,
        max_tokens: options?.max_tokens,
        json_mode: options?.json_mode,
        userId,
      });
    },

    async chatJson<T = unknown>(messages: { role: "system" | "user" | "assistant"; content: string }[], options?: { temperature?: number; max_tokens?: number }): Promise<T> {
      return callLLMJson<T>("agent_execution", messages, {
        temperature: options?.temperature,
        max_tokens: options?.max_tokens,
        userId,
      });
    },
  };
}
