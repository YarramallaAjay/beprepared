-- Seed built-in agents
INSERT INTO agents (slug, name, description, version, author, category, status, data_view_type, default_config) VALUES
  ('character', 'Character Profile', 'Builds a comprehensive profile from your social data, interview answers, and preferences.', '1.0.0', 'system', 'builtin', 'active', 'document', '{"auto_sync": true}'),
  ('interview', 'Career Interview', 'Interactive interview that discovers your career goals, tech preferences, and learning style.', '1.0.0', 'system', 'builtin', 'active', 'conversation', '{"adaptive_count": 3}'),
  ('content-discovery', 'Content Discovery', 'Searches the web for real learning resources matched to your profile and creates a personalized roadmap.', '1.0.0', 'system', 'builtin', 'active', 'recommendations', '{"roadmap_weeks": 6, "items_per_week": 7, "content_mix": "balanced"}'),
  ('daily-plan', 'Daily Plan', 'Generates a personalized daily learning plan from your content library.', '1.0.0', 'system', 'builtin', 'active', 'list', '{"auto_generate": true}'),
  ('whatsapp', 'WhatsApp Assistant', 'Manages your learning through WhatsApp.', '1.0.0', 'system', 'builtin', 'active', 'notifications', '{"enabled": true, "morning_time": "08:00", "evening_time": "20:00", "timezone": "Asia/Kolkata"}');

-- Auto-install all built-in agents for existing users
INSERT INTO user_agents (user_id, agent_id, config, execution_mode, status)
SELECT p.id, a.id, a.default_config,
  CASE a.slug
    WHEN 'whatsapp' THEN 'event_triggered'
    WHEN 'daily-plan' THEN 'on_demand'
    ELSE 'on_demand'
  END,
  'active'
FROM profiles p
CROSS JOIN agents a
WHERE a.category = 'builtin'
ON CONFLICT (user_id, agent_id) DO NOTHING;
