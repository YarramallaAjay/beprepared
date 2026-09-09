-- Add unique constraints needed for upsert operations
ALTER TABLE social_profiles ADD CONSTRAINT social_profiles_user_platform_unique UNIQUE (user_id, platform);
ALTER TABLE reminders ADD CONSTRAINT reminders_user_channel_unique UNIQUE (user_id, channel);
