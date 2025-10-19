-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- Create custom types
create type org_member_role as enum ('owner', 'admin', 'editor', 'viewer');
create type automation_mode as enum ('off', 'auto_create', 'autopilot');
create type content_type as enum ('post', 'qna', 'reply', 'image');
create type post_type as enum ('WHATS_NEW', 'EVENT', 'OFFER');
create type schedule_status as enum ('pending', 'published', 'failed', 'cancelled');
create type generation_status as enum ('pending', 'completed', 'failed', 'moderated');

-- Organizations table
create table orgs (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  plan text default 'free',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Users table (extends auth.users)
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Organization members
create table org_members (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role org_member_role not null default 'viewer',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(org_id, user_id)
);

-- Google connections (encrypted tokens)
create table connections_google (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  account_id text not null,
  refresh_token_enc text not null,
  scopes text[] not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(org_id, account_id)
);

-- GBP accounts
create table gbp_accounts (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  google_account_name text not null,
  display_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(org_id, google_account_name)
);

-- GBP locations
create table gbp_locations (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  account_id uuid references gbp_accounts(id) on delete cascade,
  google_location_name text not null,
  meta jsonb default '{}'::jsonb,
  sync_state jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(org_id, google_location_name)
);

-- GBP reviews
create table gbp_reviews (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  location_id uuid not null references gbp_locations(id) on delete cascade,
  review_id text not null,
  author text,
  rating int check (rating >= 1 and rating <= 5),
  text text,
  reply text,
  state text default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(org_id, review_id)
);

-- GBP Q&A
create table gbp_qna (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  location_id uuid not null references gbp_locations(id) on delete cascade,
  question_id text not null,
  question text not null,
  answer text,
  state text default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(org_id, question_id)
);

-- GBP media
create table gbp_media (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  location_id uuid not null references gbp_locations(id) on delete cascade,
  media_id text not null,
  url text not null,
  type text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(org_id, media_id)
);

-- AI briefs with vector embeddings
create table ai_briefs (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  location_id uuid not null references gbp_locations(id) on delete cascade,
  type text not null,
  brief jsonb not null,
  embeddings vector(3072), -- text-embedding-3-large dimension
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- AI generations
create table ai_generations (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  location_id uuid not null references gbp_locations(id) on delete cascade,
  kind content_type not null,
  input jsonb not null,
  output jsonb,
  status generation_status default 'pending',
  model text,
  costs numeric(10, 4) default 0,
  risk_score numeric(3, 2) check (risk_score >= 0 and risk_score <= 1),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Post candidates
create table post_candidates (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  location_id uuid not null references gbp_locations(id) on delete cascade,
  generation_id uuid references ai_generations(id) on delete set null,
  schema jsonb not null,
  images text[] default array[]::text[],
  status text default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Schedules
create table schedules (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  location_id uuid not null references gbp_locations(id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  publish_at timestamptz not null,
  status schedule_status default 'pending',
  provider_ref text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Automation policies
create table automation_policies (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  location_id uuid references gbp_locations(id) on delete cascade,
  content_type content_type not null,
  mode automation_mode default 'off',
  max_per_week int default 5,
  quiet_hours jsonb default '{}'::jsonb,
  risk_threshold numeric(3, 2) default 0.3 check (risk_threshold >= 0 and risk_threshold <= 1),
  require_disclaimers boolean default false,
  delete_window_sec int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(org_id, location_id, content_type)
);

-- Safety rules
create table safety_rules (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  banned_terms text[] default array[]::text[],
  required_phrases text[] default array[]::text[],
  blocked_categories text[] default array[]::text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(org_id)
);

-- Audit logs
create table audit_logs (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  actor_id uuid references users(id) on delete set null,
  action text not null,
  target text,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Create indexes for performance
create index idx_org_members_org_id on org_members(org_id);
create index idx_org_members_user_id on org_members(user_id);
create index idx_gbp_locations_org_id on gbp_locations(org_id);
create index idx_gbp_reviews_org_id on gbp_reviews(org_id);
create index idx_gbp_reviews_location_id on gbp_reviews(location_id);
create index idx_gbp_qna_org_id on gbp_qna(org_id);
create index idx_gbp_qna_location_id on gbp_qna(location_id);
create index idx_ai_generations_org_id on ai_generations(org_id);
create index idx_ai_generations_location_id on ai_generations(location_id);
create index idx_schedules_org_id on schedules(org_id);
create index idx_schedules_publish_at on schedules(publish_at) where status = 'pending';
create index idx_audit_logs_org_id on audit_logs(org_id);
create index idx_audit_logs_created_at on audit_logs(created_at);

-- Vector index intentionally omitted; pgvector ivfflat/hnsw limit 2000 dims (embeddings are 3072).

-- Update timestamp trigger function
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply update triggers to relevant tables
create trigger update_orgs_updated_at before update on orgs
  for each row execute function update_updated_at_column();

create trigger update_users_updated_at before update on users
  for each row execute function update_updated_at_column();

create trigger update_org_members_updated_at before update on org_members
  for each row execute function update_updated_at_column();

create trigger update_connections_google_updated_at before update on connections_google
  for each row execute function update_updated_at_column();

create trigger update_gbp_accounts_updated_at before update on gbp_accounts
  for each row execute function update_updated_at_column();

create trigger update_gbp_locations_updated_at before update on gbp_locations
  for each row execute function update_updated_at_column();

create trigger update_gbp_reviews_updated_at before update on gbp_reviews
  for each row execute function update_updated_at_column();

create trigger update_gbp_qna_updated_at before update on gbp_qna
  for each row execute function update_updated_at_column();

create trigger update_gbp_media_updated_at before update on gbp_media
  for each row execute function update_updated_at_column();

create trigger update_ai_briefs_updated_at before update on ai_briefs
  for each row execute function update_updated_at_column();

create trigger update_ai_generations_updated_at before update on ai_generations
  for each row execute function update_updated_at_column();

create trigger update_post_candidates_updated_at before update on post_candidates
  for each row execute function update_updated_at_column();

create trigger update_schedules_updated_at before update on schedules
  for each row execute function update_updated_at_column();

create trigger update_automation_policies_updated_at before update on automation_policies
  for each row execute function update_updated_at_column();

create trigger update_safety_rules_updated_at before update on safety_rules
  for each row execute function update_updated_at_column();
