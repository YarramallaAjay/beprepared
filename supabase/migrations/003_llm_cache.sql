CREATE TABLE llm_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE,
  feature TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_llm_cache_key ON llm_cache(cache_key);
CREATE INDEX idx_llm_cache_expires ON llm_cache(expires_at);
