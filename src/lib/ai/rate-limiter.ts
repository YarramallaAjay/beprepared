import type { ProviderName } from "./model-config";

interface ProviderState {
  requests: number[];    // timestamps of recent requests
  tokens: number[];      // [timestamp, tokenCount][] for token-based limits
  rateLimitedUntil: number; // timestamp when rate limit expires
  inFlight: boolean;     // for ollama
}

const state = new Map<string, ProviderState>();

function getState(key: string): ProviderState {
  if (!state.has(key)) {
    state.set(key, {
      requests: [],
      tokens: [],
      rateLimitedUntil: 0,
      inFlight: false,
    });
  }
  return state.get(key)!;
}

function stateKey(provider: ProviderName, model: string): string {
  return `${provider}:${model}`;
}

// Per-provider limits
const LIMITS: Record<ProviderName, { reqPerMin: number; tokensPerMin?: number }> = {
  gemini: { reqPerMin: 5 },        // 5 req/min per model
  groq: { reqPerMin: 30, tokensPerMin: 1000 }, // 1000 output tokens/min
  openrouter: { reqPerMin: 20 },    // ~20 req/min
  ollama: { reqPerMin: 1 },         // 1 concurrent request
};

const WINDOW_MS = 60_000; // 1 minute window

/**
 * Check if a request can be made to this provider/model without exceeding rate limits.
 */
export function canMakeRequest(provider: ProviderName, model: string): boolean {
  const key = stateKey(provider, model);
  const s = getState(key);
  const now = Date.now();

  // Check if explicitly rate-limited
  if (s.rateLimitedUntil > now) {
    return false;
  }

  // Ollama: check if already in-flight
  if (provider === "ollama" && s.inFlight) {
    return false;
  }

  // Clean old entries
  s.requests = s.requests.filter((t) => now - t < WINDOW_MS);

  const limit = LIMITS[provider];

  // Check request count
  if (s.requests.length >= limit.reqPerMin) {
    return false;
  }

  return true;
}

/**
 * Record a completed request for rate tracking.
 */
export function recordRequest(
  provider: ProviderName,
  model: string,
  outputTokens?: number
): void {
  const key = stateKey(provider, model);
  const s = getState(key);
  const now = Date.now();

  s.requests.push(now);

  if (provider === "ollama") {
    s.inFlight = false;
  }

  if (outputTokens && LIMITS[provider].tokensPerMin) {
    s.tokens.push(now, outputTokens);
  }
}

/**
 * Mark a request as started (for ollama in-flight tracking).
 */
export function markRequestStarted(
  provider: ProviderName,
  model: string
): void {
  if (provider === "ollama") {
    const key = stateKey(provider, model);
    const s = getState(key);
    s.inFlight = true;
  }
}

/**
 * Mark a provider/model as rate-limited after receiving a 429.
 * Blocks requests for 60 seconds.
 */
export function markRateLimited(
  provider: ProviderName,
  model: string
): void {
  const key = stateKey(provider, model);
  const s = getState(key);
  s.rateLimitedUntil = Date.now() + 60_000;

  if (provider === "ollama") {
    s.inFlight = false;
  }

  console.warn(`[Rate Limiter] ${provider}/${model} rate-limited for 60s`);
}
