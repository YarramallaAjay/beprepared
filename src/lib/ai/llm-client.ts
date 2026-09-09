import { AIFeature, MODEL_CONFIG, ProviderName } from "./model-config";
import { callOpenRouter } from "./providers/openrouter";
import { callGemini } from "./providers/gemini";
import { callGroq } from "./providers/groq";
import { callOllama } from "./providers/ollama";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMOptions {
  temperature?: number;
  max_tokens?: number;
  json_mode?: boolean;
}

type ProviderCallFn = (
  model: string,
  messages: LLMMessage[],
  options?: { temperature?: number; max_tokens?: number; response_format?: { type: string } }
) => Promise<string>;

const providerFns: Record<ProviderName, ProviderCallFn> = {
  openrouter: callOpenRouter,
  gemini: callGemini,
  groq: callGroq,
  ollama: callOllama,
};

function isProviderAvailable(provider: ProviderName): boolean {
  switch (provider) {
    case "openrouter":
      return !!process.env.OPENROUTER_API_KEY;
    case "gemini":
      return !!process.env.GOOGLE_GEMINI_API_KEY;
    case "groq":
      return !!process.env.GROQ_API_KEY;
    case "ollama":
      // Ollama is always "available" -- it'll fail at call time if not running
      return true;
  }
}

function isRetryable(error: string): boolean {
  return error.includes("429") || error.includes("503") || error.includes("rate") || error.includes("quota");
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call an LLM with automatic fallback through the provider chain.
 * For 429/503 errors, retries the same provider once after a delay before moving on.
 */
export async function callLLM(
  feature: AIFeature,
  messages: LLMMessage[],
  options?: LLMOptions
): Promise<string> {
  const assignments = MODEL_CONFIG[feature];
  const errors: { provider: string; model: string; error: string }[] = [];

  for (const assignment of assignments) {
    if (!isProviderAvailable(assignment.provider)) {
      errors.push({
        provider: assignment.provider,
        model: assignment.model,
        error: "API key not configured",
      });
      continue;
    }

    const callOptions = {
      temperature: options?.temperature,
      max_tokens: assignment.max_tokens ?? options?.max_tokens ?? 2048,
      ...(options?.json_mode ? { response_format: { type: "json_object" } } : {}),
    };

    const fn = providerFns[assignment.provider];

    // Try up to 2 times (initial + 1 retry for rate limits)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await fn(assignment.model, messages, callOptions);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);

        if (attempt === 0 && isRetryable(message)) {
          // Wait before retrying (longer for quota errors)
          const delay = message.includes("quota") ? 10000 : 3000;
          console.warn(
            `[LLM] ${assignment.provider}/${assignment.model} rate-limited, retrying in ${delay}ms...`
          );
          await sleep(delay);
          continue;
        }

        errors.push({ provider: assignment.provider, model: assignment.model, error: message });
        console.warn(
          `[LLM] ${assignment.provider}/${assignment.model} failed: ${message}. Trying next...`
        );
        break;
      }
    }
  }

  throw new Error(
    `All LLM providers failed for feature "${feature}":\n${errors
      .map((e) => `  - ${e.provider}/${e.model}: ${e.error}`)
      .join("\n")}`
  );
}

/**
 * Call LLM and parse the response as JSON.
 */
export async function callLLMJson<T = unknown>(
  feature: AIFeature,
  messages: LLMMessage[],
  options?: Omit<LLMOptions, "json_mode">
): Promise<T> {
  const response = await callLLM(feature, messages, {
    ...options,
    json_mode: true,
  });

  // Try to extract JSON from the response (handles markdown code blocks)
  let jsonStr = response;
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  return JSON.parse(jsonStr) as T;
}
