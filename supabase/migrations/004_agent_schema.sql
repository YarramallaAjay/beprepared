-- Agent definitions (registry of all available agents)
CREATE TABLE agents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  version TEXT NOT NULL DEFAULT '1.0.0',
  author TEXT NOT NULL DEFAULT 'system',
  category TEXT NOT NULL DEFAULT 'builtin'
    CHECK (category IN ('builtin', 'custom', 'marketplace')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft', 'active', 'deprecated', 'disabled')),
  definition JSONB NOT NULL DEFAULT '{}',
  config_schema JSONB DEFAULT '{}',
  default_config JSONB DEFAULT '{}',
  permissions TEXT[] DEFAULT '{}',
  required_tools TEXT[] DEFAULT '{}',
  mcp_connections JSONB DEFAULT '[]',
  data_view_type TEXT NOT NULL DEFAULT 'list'
    CHECK (data_view_type IN (
      'feed', 'list', 'table', 'chart', 'embed', 'document',
      'image', 'recommendations', 'notifications', 'summary',
      'conversation', 'calendar'
    )),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- User agent installations
CREATE TABLE user_agents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
  config JSONB DEFAULT '{}',
  execution_mode TEXT NOT NULL DEFAULT 'on_demand'
    CHECK (execution_mode IN ('scheduled', 'event_triggered', 'on_demand')),
  schedule TEXT,
  event_triggers TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'error', 'configuring')),
  display_order INTEGER DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, agent_id)
);

-- Agent execution runs
CREATE TABLE agent_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_agent_id UUID REFERENCES user_agents(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'manual'
    CHECK (trigger_type IN ('manual', 'scheduled', 'event', 'system')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  input_params JSONB DEFAULT '{}',
  output_data JSONB,
  data_view JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Agent-specific key-value storage
CREATE TABLE agent_storage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_agent_id UUID REFERENCES user_agents(id) ON DELETE CASCADE NOT NULL,
  storage_key TEXT NOT NULL,
  storage_value JSONB NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_agent_id, storage_key)
);

-- Latest data view per user-agent
CREATE TABLE agent_data_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_agent_id UUID REFERENCES user_agents(id) ON DELETE CASCADE NOT NULL,
  agent_run_id UUID REFERENCES agent_runs(id) ON DELETE SET NULL,
  view_type TEXT NOT NULL,
  view_data JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  UNIQUE(user_agent_id)
);

-- Indexes
CREATE INDEX idx_user_agents_user ON user_agents(user_id);
CREATE INDEX idx_user_agents_status ON user_agents(user_id, status);
CREATE INDEX idx_user_agents_schedule ON user_agents(execution_mode, status) WHERE execution_mode = 'scheduled';
CREATE INDEX idx_agent_runs_user_agent ON agent_runs(user_agent_id);
CREATE INDEX idx_agent_runs_user ON agent_runs(user_id);
CREATE INDEX idx_agent_runs_status ON agent_runs(user_id, status);
CREATE INDEX idx_agent_storage_key ON agent_storage(user_agent_id, storage_key);
CREATE INDEX idx_agent_data_views_user_agent ON agent_data_views(user_agent_id);

-- RLS
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_storage ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_data_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents are publicly readable" ON agents FOR SELECT USING (status = 'active');
CREATE POLICY "Users manage own agent installations" ON user_agents FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users view own runs" ON agent_runs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own storage" ON agent_storage FOR ALL USING (
  EXISTS (SELECT 1 FROM user_agents WHERE user_agents.id = agent_storage.user_agent_id AND user_agents.user_id = auth.uid())
);
CREATE POLICY "Users view own data views" ON agent_data_views FOR ALL USING (
  EXISTS (SELECT 1 FROM user_agents WHERE user_agents.id = agent_data_views.user_agent_id AND user_agents.user_id = auth.uid())
);

-- Updated_at triggers
CREATE TRIGGER agents_updated_at BEFORE UPDATE ON agents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER user_agents_updated_at BEFORE UPDATE ON user_agents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER agent_storage_updated_at BEFORE UPDATE ON agent_storage FOR EACH ROW EXECUTE FUNCTION update_updated_at();
