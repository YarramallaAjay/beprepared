export type AIFeature =
  | "interview_questions"
  | "content_curation"
  | "daily_plan"
  | "whatsapp_parsing"
  | "adaptive_followup"
  | "character_building";

export type ProviderName = "openrouter" | "gemini" | "groq" | "ollama";

export interface ModelAssignment {
  provider: ProviderName;
  model: string;
  max_tokens?: number; // override per-assignment (Groq free tier caps at 1000 OTPM)
}

// Verified working Sep 10 2026
// Spread Gemini calls across different models to avoid per-model rate limits (5 req/min each)
// Groq free tier: 1000 output tokens/min, so cap max_tokens low
// Ollama: local fallback, no rate limits
export const MODEL_CONFIG: Record<AIFeature, ModelAssignment[]> = {
  interview_questions: [
    { provider: "gemini", model: "gemini-3.8-flash" },
    { provider: "openrouter", model: "google/gemma-4-31b-it:free" },
    { provider: "groq", model: "qwen/qwen3.8-27b", max_tokens: 900 },
    { provider: "gemini", model: "gemini-3.6-flash" },
    { provider: "ollama", model: "gemma4:26b" },
  ],
  content_curation: [
    { provider: "gemini", model: "gemini-3.6-flash" },
    { provider: "openrouter", model: "google/gemma-4-31b-it:free" },
    { provider: "groq", model: "openai/gpt-oss-20b", max_tokens: 900 },
    { provider: "gemini", model: "gemini-3.8-flash" },
    { provider: "ollama", model: "gemma4:26b" },
  ],
  daily_plan: [
    { provider: "gemini", model: "gemini-3.7-flash" },
    { provider: "openrouter", model: "google/gemma-4-26b-a4b-it:free" },
    { provider: "groq", model: "openai/gpt-oss-20b", max_tokens: 900 },
    { provider: "gemini", model: "gemini-3.6-flash" },
    { provider: "ollama", model: "gemma4:26b" },
  ],
  whatsapp_parsing: [
    { provider: "groq", model: "openai/gpt-oss-20b", max_tokens: 200 },
    { provider: "gemini", model: "gemini-3.6-flash" },
    { provider: "openrouter", model: "google/gemma-4-26b-a4b-it:free" },
    { provider: "ollama", model: "gemma4:26b" },
  ],
  adaptive_followup: [
    { provider: "gemini", model: "gemini-3.7-flash" },
    { provider: "openrouter", model: "google/gemma-4-31b-it:free" },
    { provider: "groq", model: "qwen/qwen3.8-27b", max_tokens: 900 },
    { provider: "gemini", model: "gemini-3.8-flash" },
    { provider: "ollama", model: "gemma4:26b" },
  ],
  character_building: [
    { provider: "gemini", model: "gemini-3.8-flash" },
    { provider: "openrouter", model: "nvidia/nemotron-3-super-120b-a12b:free" },
    { provider: "groq", model: "openai/gpt-oss-120b", max_tokens: 900 },
    { provider: "gemini", model: "gemini-3.6-flash" },
    { provider: "ollama", model: "gemma4:26b" },
  ],
};
