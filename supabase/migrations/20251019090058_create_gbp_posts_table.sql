-- Create gbp_posts table for storing Google Business Profile posts
create table if not exists gbp_posts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  location_id uuid not null references gbp_locations(id) on delete cascade,

  -- Google post identifiers
  google_post_name text not null, -- Full resource name from Google (e.g. "accounts/*/locations/*/localPosts/*")

  -- Post content
  summary text, -- Post body text
  topic_type text, -- STANDARD, EVENT, OFFER, etc.
  call_to_action_type text, -- LEARN_MORE, CALL, SIGN_UP, etc.
  call_to_action_url text,

  -- Event details (if topic_type = EVENT)
  event_title text,
  event_start_date date,
  event_end_date date,

  -- Offer details (if topic_type = OFFER)
  offer_coupon_code text,
  offer_redeem_url text,
  offer_terms text,

  -- Media
  media_urls text[], -- Array of media URLs

  -- State and metadata
  state text, -- LIVE, EXPIRED, REJECTED, etc.
  search_url text, -- Direct link to view the post
  meta jsonb, -- Full raw response from Google for reference

  -- Timestamps
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  google_create_time timestamptz,
  google_update_time timestamptz,

  -- Unique constraint to prevent duplicate posts
  unique(org_id, google_post_name)
);

-- Enable RLS
alter table gbp_posts enable row level security;

-- RLS policies
create policy "Users can view their org's posts"
  on gbp_posts for select
  using (org_id in (select public.user_org_ids()));

create policy "Editors can insert posts"
  on gbp_posts for insert
  with check (
    org_id in (select public.user_org_ids())
    and public.user_org_role(org_id) in ('owner', 'admin', 'editor')
  );

create policy "Editors can update posts"
  on gbp_posts for update
  using (
    org_id in (select public.user_org_ids())
    and public.user_org_role(org_id) in ('owner', 'admin', 'editor')
  );

create policy "Owners can delete posts"
  on gbp_posts for delete
  using (
    org_id in (select public.user_org_ids())
    and public.user_org_role(org_id) = 'owner'
  );

-- Indexes for performance
create index gbp_posts_org_id_idx on gbp_posts(org_id);
create index gbp_posts_location_id_idx on gbp_posts(location_id);
create index gbp_posts_state_idx on gbp_posts(state);
create index gbp_posts_google_create_time_idx on gbp_posts(google_create_time desc);

-- Updated at trigger
create trigger set_gbp_posts_updated_at
  before update on gbp_posts
  for each row
  execute function update_updated_at_column();
