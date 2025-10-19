-- Enable RLS on all tables
alter table orgs enable row level security;
alter table users enable row level security;
alter table org_members enable row level security;
alter table connections_google enable row level security;
alter table gbp_accounts enable row level security;
alter table gbp_locations enable row level security;
alter table gbp_reviews enable row level security;
alter table gbp_qna enable row level security;
alter table gbp_media enable row level security;
alter table ai_briefs enable row level security;
alter table ai_generations enable row level security;
alter table post_candidates enable row level security;
alter table schedules enable row level security;
alter table automation_policies enable row level security;
alter table safety_rules enable row level security;
alter table audit_logs enable row level security;

-- Helper function to get user's org IDs
create or replace function public.user_org_ids()
returns table(org_id uuid) as $$
  select org_id from org_members where user_id = auth.uid();
$$ language sql security definer;

-- Helper function to check if user belongs to org
create or replace function public.user_has_org_access(check_org_id uuid)
returns boolean as $$
  select exists(
    select 1 from org_members 
    where org_id = check_org_id 
    and user_id = auth.uid()
  );
$$ language sql security definer;

-- Helper function to check user role in org
create or replace function public.user_org_role(check_org_id uuid)
returns org_member_role as $$
  select role from org_members 
  where org_id = check_org_id 
  and user_id = auth.uid()
  limit 1;
$$ language sql security definer;

-- Orgs policies
create policy "Users can view their orgs"
  on orgs for select
  using (id in (select public.user_org_ids()));

create policy "Org owners and admins can update their orgs"
  on orgs for update
  using (
    id in (select public.user_org_ids()) 
    and public.user_org_role(id) in ('owner', 'admin')
  );

create policy "Org owners can delete their orgs"
  on orgs for delete
  using (
    id in (select public.user_org_ids()) 
    and public.user_org_role(id) = 'owner'
  );

-- Users policies
create policy "Users can view their own profile"
  on users for select
  using (id = auth.uid());

create policy "Users can update their own profile"
  on users for update
  using (id = auth.uid());

create policy "Users can insert their own profile"
  on users for insert
  with check (id = auth.uid());

-- Org members policies
create policy "Users can view members of their orgs"
  on org_members for select
  using (org_id in (select public.user_org_ids()));

create policy "Org owners and admins can insert members"
  on org_members for insert
  with check (
    org_id in (select public.user_org_ids()) 
    and public.user_org_role(org_id) in ('owner', 'admin')
  );

create policy "Org owners and admins can update members"
  on org_members for update
  using (
    org_id in (select public.user_org_ids()) 
    and public.user_org_role(org_id) in ('owner', 'admin')
  );

create policy "Org owners can delete members"
  on org_members for delete
  using (
    org_id in (select public.user_org_ids()) 
    and public.user_org_role(org_id) = 'owner'
  );

-- Connections policies
create policy "Users can view their org's connections"
  on connections_google for select
  using (org_id in (select public.user_org_ids()));

create policy "Org admins can manage connections"
  on connections_google for all
  using (
    org_id in (select public.user_org_ids()) 
    and public.user_org_role(org_id) in ('owner', 'admin')
  );

-- GBP accounts policies
create policy "Users can view their org's GBP accounts"
  on gbp_accounts for select
  using (org_id in (select public.user_org_ids()));

create policy "Org admins can manage GBP accounts"
  on gbp_accounts for all
  using (
    org_id in (select public.user_org_ids()) 
    and public.user_org_role(org_id) in ('owner', 'admin')
  );

-- GBP locations policies
create policy "Users can view their org's locations"
  on gbp_locations for select
  using (org_id in (select public.user_org_ids()));

create policy "Editors can manage locations"
  on gbp_locations for all
  using (
    org_id in (select public.user_org_ids()) 
    and public.user_org_role(org_id) in ('owner', 'admin', 'editor')
  );

-- GBP reviews policies
create policy "Users can view their org's reviews"
  on gbp_reviews for select
  using (org_id in (select public.user_org_ids()));

create policy "Editors can manage reviews"
  on gbp_reviews for all
  using (
    org_id in (select public.user_org_ids()) 
    and public.user_org_role(org_id) in ('owner', 'admin', 'editor')
  );

-- GBP Q&A policies
create policy "Users can view their org's Q&A"
  on gbp_qna for select
  using (org_id in (select public.user_org_ids()));

create policy "Editors can manage Q&A"
  on gbp_qna for all
  using (
    org_id in (select public.user_org_ids()) 
    and public.user_org_role(org_id) in ('owner', 'admin', 'editor')
  );

-- GBP media policies
create policy "Users can view their org's media"
  on gbp_media for select
  using (org_id in (select public.user_org_ids()));

create policy "Editors can manage media"
  on gbp_media for all
  using (
    org_id in (select public.user_org_ids()) 
    and public.user_org_role(org_id) in ('owner', 'admin', 'editor')
  );

-- AI briefs policies
create policy "Users can view their org's AI briefs"
  on ai_briefs for select
  using (org_id in (select public.user_org_ids()));

create policy "Editors can manage AI briefs"
  on ai_briefs for all
  using (
    org_id in (select public.user_org_ids()) 
    and public.user_org_role(org_id) in ('owner', 'admin', 'editor')
  );

-- AI generations policies
create policy "Users can view their org's AI generations"
  on ai_generations for select
  using (org_id in (select public.user_org_ids()));

create policy "Editors can manage AI generations"
  on ai_generations for all
  using (
    org_id in (select public.user_org_ids()) 
    and public.user_org_role(org_id) in ('owner', 'admin', 'editor')
  );

-- Post candidates policies
create policy "Users can view their org's post candidates"
  on post_candidates for select
  using (org_id in (select public.user_org_ids()));

create policy "Editors can manage post candidates"
  on post_candidates for all
  using (
    org_id in (select public.user_org_ids()) 
    and public.user_org_role(org_id) in ('owner', 'admin', 'editor')
  );

-- Schedules policies
create policy "Users can view their org's schedules"
  on schedules for select
  using (org_id in (select public.user_org_ids()));

create policy "Editors can manage schedules"
  on schedules for all
  using (
    org_id in (select public.user_org_ids()) 
    and public.user_org_role(org_id) in ('owner', 'admin', 'editor')
  );

-- Automation policies
create policy "Users can view their org's automation policies"
  on automation_policies for select
  using (org_id in (select public.user_org_ids()));

create policy "Admins can manage automation policies"
  on automation_policies for all
  using (
    org_id in (select public.user_org_ids()) 
    and public.user_org_role(org_id) in ('owner', 'admin')
  );

-- Safety rules policies
create policy "Users can view their org's safety rules"
  on safety_rules for select
  using (org_id in (select public.user_org_ids()));

create policy "Admins can manage safety rules"
  on safety_rules for all
  using (
    org_id in (select public.user_org_ids()) 
    and public.user_org_role(org_id) in ('owner', 'admin')
  );

-- Audit logs policies (read-only for most users)
create policy "Users can view their org's audit logs"
  on audit_logs for select
  using (org_id in (select public.user_org_ids()));

create policy "System can insert audit logs"
  on audit_logs for insert
  with check (org_id in (select public.user_org_ids()));

-- Grant necessary permissions to authenticated users
grant usage on schema public to authenticated;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;

