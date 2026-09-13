-- Add icon and color columns to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT '🤖';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#34d399';

-- Update built-in agents with icons and colors
UPDATE agents SET icon = '👤', color = '#8b5cf6' WHERE slug = 'character';
UPDATE agents SET icon = '🎯', color = '#f59e0b' WHERE slug = 'interview';
UPDATE agents SET icon = '🔍', color = '#34d399' WHERE slug = 'content-discovery';
UPDATE agents SET icon = '📋', color = '#3b82f6' WHERE slug = 'daily-plan';
UPDATE agents SET icon = '💬', color = '#22c55e' WHERE slug = 'whatsapp';

-- Populate config_schema for built-in agents that have config fields
UPDATE agents SET config_schema = '[
  {"key": "auto_sync", "label": "Auto Sync", "type": "boolean", "default": true, "description": "Automatically sync character profile weekly"}
]'::jsonb WHERE slug = 'character';

UPDATE agents SET config_schema = '[
  {"key": "adaptive_count", "label": "Adaptive Questions", "type": "number", "default": 3, "description": "Number of adaptive follow-up questions", "validation": {"min": 1, "max": 10}}
]'::jsonb WHERE slug = 'interview';

UPDATE agents SET config_schema = '[
  {"key": "roadmap_weeks", "label": "Roadmap Weeks", "type": "number", "default": 6, "description": "Number of weeks in the learning roadmap", "validation": {"min": 1, "max": 24}},
  {"key": "items_per_week", "label": "Items Per Week", "type": "number", "default": 7, "description": "Number of content items per week", "validation": {"min": 3, "max": 14}},
  {"key": "content_mix", "label": "Content Mix", "type": "select", "default": "balanced", "description": "Balance between content types", "options": [{"label": "Balanced", "value": "balanced"}, {"label": "Video Heavy", "value": "video_heavy"}, {"label": "Reading Heavy", "value": "reading_heavy"}]}
]'::jsonb WHERE slug = 'content-discovery';

UPDATE agents SET config_schema = '[
  {"key": "auto_generate", "label": "Auto Generate", "type": "boolean", "default": true, "description": "Automatically generate daily plan"}
]'::jsonb WHERE slug = 'daily-plan';

UPDATE agents SET config_schema = '[
  {"key": "enabled", "label": "Enabled", "type": "boolean", "default": true, "description": "Enable WhatsApp notifications"},
  {"key": "morning_time", "label": "Morning Time", "type": "string", "default": "08:00", "description": "Time for morning motivation message"},
  {"key": "evening_time", "label": "Evening Time", "type": "string", "default": "20:00", "description": "Time for evening recap message"},
  {"key": "timezone", "label": "Timezone", "type": "string", "default": "Asia/Kolkata", "description": "Your timezone"}
]'::jsonb WHERE slug = 'whatsapp';
