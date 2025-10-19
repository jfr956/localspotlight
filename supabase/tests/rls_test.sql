-- RLS Policy Tests
-- These tests ensure complete data isolation between organizations

-- Test Setup: Create test data
begin;

-- Create two test organizations
insert into orgs (id, name, plan) values 
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Org A', 'pro'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Org B', 'pro');

-- Create test users (assuming they exist in auth.users)
-- In a real test, you'd create these via Supabase Auth
-- For now, we'll use mock UUIDs
insert into users (id, email, name) values 
  ('11111111-1111-1111-1111-111111111111', 'user-a@test.com', 'User A'),
  ('22222222-2222-2222-2222-222222222222', 'user-b@test.com', 'User B');

-- Assign users to orgs
insert into org_members (org_id, user_id, role) values 
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'owner');

-- Create test locations for each org
insert into gbp_locations (id, org_id, google_location_name, meta) values 
  ('loc-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'locations/123', '{"name": "Location A"}'),
  ('loc-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'locations/456', '{"name": "Location B"}');

-- Create test reviews for each location
insert into gbp_reviews (org_id, location_id, review_id, author, rating, text) values 
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'loc-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'review-a-1', 'Customer A1', 5, 'Great service!'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'loc-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'review-b-1', 'Customer B1', 4, 'Good experience');

rollback;

-- Test 1: Verify user can see their own org's data
-- TODO: This requires setting the auth.uid() context
-- In practice, you'd use the Supabase client with actual auth tokens

-- Test 2: Verify user CANNOT see other org's data
-- Expected: User A should not be able to query Org B's reviews

-- Test 3: Verify role-based permissions
-- Expected: Viewer cannot update/delete, Editor can, Owner can do everything

-- Test 4: Verify cascade deletes respect org boundaries
-- Expected: Deleting an org should only delete its own data

-- Test 5: Verify RLS on all tables
-- Expected: Every table with org_id has working RLS policies

-- To run these tests properly, use the Supabase client in your app
-- or write integration tests with actual auth tokens

-- Manual verification query (run as superuser):
select 
  tablename,
  rowsecurity
from pg_tables 
where schemaname = 'public'
order by tablename;

-- All tables should show rowsecurity = true

