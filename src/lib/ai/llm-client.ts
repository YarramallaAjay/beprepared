import { AIFeature, MODEL_CONFIG, ProviderName } from "./model-config";
import { callOpenRouter } from "./providers/openrouter";
import { callGemini } from "./providers/gemini";
import { callGroq } from "./providers/groq";
import { callOllama } from "./providers/ollama";
import { getCachedResponse, setCachedResponse } from "./llm-cache";
import {
  canMakeRequest,
  recordRequest,
  markRequestStarted,
  markRateLimited,
} from "./rate-limiter";
import { buildUserContext } from "./user-context";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMOptions {
  temperature?: number;
  max_tokens?: number;
  json_mode?: boolean;
  userId?: string;
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
      return true;
  }
}

function isRetryable(error: string): boolean {
  return (
    error.includes("429") ||
    error.includes("503") ||
    error.includes("529") ||
    error.includes("rate") ||
    error.includes("quota") ||
    error.includes("overloaded")
  );
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Inject user context into messages by prepending it to the system prompt.
 */
async function injectUserContext(
  messages: LLMMessage[],
  userId: string
): Promise<LLMMessage[]> {
  const context = await buildUserContext(userId);
  const injected = [...messages];

  const systemIdx = injected.findIndex((m) => m.role === "system");
  if (systemIdx >= 0) {
    injected[systemIdx] = {
      ...injected[systemIdx],
      content: `${context}\n\n${injected[systemIdx].content}`,
    };
  } else {
    injected.unshift({ role: "system", content: context });
  }

  return injected;
}

/**
 * Call an LLM with automatic fallback through the provider chain.
 * Integrates: user context injection, response caching, rate-limit-aware provider selection.
 */
export async function callLLM(
  feature: AIFeature,
  messages: LLMMessage[],
  options?: LLMOptions
): Promise<string> {
  // Inject user context if userId provided
  let finalMessages = messages;
  if (options?.userId) {
    finalMessages = await injectUserContext(messages, options.userId);
  }

  // Check cache before making any provider calls
  const cached = await getCachedResponse(feature, finalMessages);
  if (cached) {
    return cached;
  }

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

    // Check rate limiter before attempting
    if (!canMakeRequest(assignment.provider, assignment.model)) {
      console.warn(
        `[LLM] Skipping ${assignment.provider}/${assignment.model} (rate limited)`
      );
      errors.push({
        provider: assignment.provider,
        model: assignment.model,
        error: "Pre-emptively skipped (rate limited)",
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
        markRequestStarted(assignment.provider, assignment.model);
        const result = await fn(assignment.model, finalMessages, callOptions);
        recordRequest(assignment.provider, assignment.model);

        // Cache the successful response
        await setCachedResponse(feature, finalMessages, result);

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);

        if (isRetryable(message)) {
          markRateLimited(assignment.provider, assignment.model);

          if (attempt === 0) {
            const delay = message.includes("quota") ? 10000 : 3000;
            console.warn(
              `[LLM] ${assignment.provider}/${assignment.model} rate-limited, retrying in ${delay}ms...`
            );
            await sleep(delay);
            continue;
          }
        }

        recordRequest(assignment.provider, assignment.model);
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
