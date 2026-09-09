-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table: stores user interview data and preferences
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  target_role text,
  current_role text,
  experience_years integer,
  tech_stack text[],
  strengths text[],
  weaknesses text[],
  domain_experience text[],
  tech_targets text[],
  daily_hours_available numeric(3,1) default 2.0,
  preferred_learning_time text default 'morning',
  interview_answers jsonb default '{}',
  onboarding_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Social profiles linked by user
create table social_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade not null,
  platform text not null check (platform in ('linkedin', 'github', 'reddit', 'twitter', 'other')),
  username_or_url text not null,
  scraped_data jsonb default '{}',
  last_synced_at timestamptz,
  created_at timestamptz default now()
);

-- Character documents generated from social data + interview
create table character_documents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade not null,
  content_md text not null,
  version integer default 1,
  change_log text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Preferred content sources (people, channels, blogs, platforms)
create table preferred_sources (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade not null,
  source_name text not null,
  source_type text not null check (source_type in ('person', 'channel', 'blog', 'platform', 'course_platform')),
  source_url text,
  priority_rank integer default 0,
  created_at timestamptz default now()
);

-- Curated content items
create table content_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  url text,
  content_type text not null check (content_type in ('blog', 'video', 'course', 'repo', 'documentation', 'practice', 'other')),
  topic text,
  description text,
  estimated_minutes integer,
  priority integer default 0,
  source_origin text,
  week_number integer,
  status text default 'pending' check (status in ('pending', 'completed', 'skipped')),
  created_at timestamptz default now()
);

-- Daily learning plans
create table daily_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade not null,
  plan_date date not null,
  created_at timestamptz default now(),
  unique(user_id, plan_date)
);

-- Items within daily plans
create table daily_plan_items (
  id uuid primary key default uuid_generate_v4(),
  daily_plan_id uuid references daily_plans(id) on delete cascade not null,
  content_item_id uuid references content_items(id) on delete cascade not null,
  item_order integer default 0,
  status text default 'pending' check (status in ('pending', 'in_progress', 'completed', 'skipped')),
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- Reminder settings
create table reminders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade not null,
  channel text not null check (channel in ('whatsapp', 'email', 'web_push')),
  phone_number text,
  email text,
  morning_time time default '08:00',
  evening_time time default '20:00',
  timezone text default 'Asia/Kolkata',
  enabled boolean default true,
  created_at timestamptz default now()
);

-- Indexes
create index idx_content_items_user on content_items(user_id);
create index idx_content_items_status on content_items(user_id, status);
create index idx_daily_plans_user_date on daily_plans(user_id, plan_date);
create index idx_daily_plan_items_plan on daily_plan_items(daily_plan_id);
create index idx_social_profiles_user on social_profiles(user_id);
create index idx_preferred_sources_user on preferred_sources(user_id, priority_rank);

-- Row Level Security
alter table profiles enable row level security;
alter table social_profiles enable row level security;
alter table character_documents enable row level security;
alter table preferred_sources enable row level security;
alter table content_items enable row level security;
alter table daily_plans enable row level security;
alter table daily_plan_items enable row level security;
alter table reminders enable row level security;

-- RLS Policies: users can only access their own data
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

create policy "Users can manage own social profiles" on social_profiles for all using (auth.uid() = user_id);
create policy "Users can manage own character docs" on character_documents for all using (auth.uid() = user_id);
create policy "Users can manage own sources" on preferred_sources for all using (auth.uid() = user_id);
create policy "Users can manage own content" on content_items for all using (auth.uid() = user_id);
create policy "Users can manage own plans" on daily_plans for all using (auth.uid() = user_id);
create policy "Users can manage own plan items" on daily_plan_items for all using (
  exists (select 1 from daily_plans where daily_plans.id = daily_plan_items.daily_plan_id and daily_plans.user_id = auth.uid())
);
create policy "Users can manage own reminders" on reminders for all using (auth.uid() = user_id);

-- Updated_at trigger function
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at before update on profiles for each row execute function update_updated_at();
create trigger character_documents_updated_at before update on character_documents for each row execute function update_updated_at();
