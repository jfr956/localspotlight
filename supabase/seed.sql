-- ============================================================================
-- LocalSpotlight Seed Data for Local Development
-- ============================================================================
-- This file provides comprehensive test data for local development and testing.
-- It is idempotent and can be run multiple times safely.
--
-- TEST CREDENTIALS:
-- -----------------
-- User 1 (Owner of Acme Coffee):
--   Email: jasonfreynolds@gmail.com
--   Password: thematrix
--   Role: owner
--   Org: Acme Coffee Shops
--
-- User 2 (Admin of Digital Solutions):
--   Email: admin@digitalsolutions.test
--   Password: [Create via Supabase Auth UI]
--   Role: admin
--   Org: Digital Solutions Agency
--
-- USAGE:
-- ------
-- Local: supabase db reset (runs migrations + seed automatically)
-- Manual: psql -h localhost -p 54322 -U postgres -d postgres -f supabase/seed.sql
--
-- ============================================================================

-- Begin transaction for atomicity
begin;

-- ============================================================================
-- 1. ORGANIZATIONS
-- ============================================================================
-- Create two test organizations with different plans

insert into orgs (id, name, plan, created_at)
values
  (
    '00000001-0001-0001-0001-000000000001',
    'Acme Coffee Shops',
    'pro',
    now() - interval '90 days'
  ),
  (
    '00000002-0002-0002-0002-000000000002',
    'Digital Solutions Agency',
    'enterprise',
    now() - interval '120 days'
  )
on conflict (id) do update
  set name = excluded.name,
      plan = excluded.plan;

-- ============================================================================
-- 2. USERS
-- ============================================================================
-- Note: Users are managed by Supabase Auth (auth.users table)
-- The test user jasonfreynolds@gmail.com should be created via:
--   supabase auth signup --email jasonfreynolds@gmail.com --password thematrix
--
-- We'll create placeholder user records that will link to auth.users
-- In production, these are created via trigger on auth.users insert

-- For seeding purposes, we'll use known UUIDs that you'll need to match
-- after creating users in Supabase Auth. Update these IDs after user creation.

-- Placeholder for linking user data (will be populated after auth signup)
-- insert into users (id, email, name)
-- values
--   ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'jasonfreynolds@gmail.com', 'Jason Reynolds')
-- on conflict (id) do update
--   set email = excluded.email,
--       name = excluded.name;

-- ============================================================================
-- 3. ORG MEMBERS
-- ============================================================================
-- Link users to organizations with roles
-- NOTE: This section will work once users are created in auth.users
-- For now, we'll comment it out and provide instructions below

-- Example of linking existing user to org:
-- insert into org_members (org_id, user_id, role)
-- values
--   ('00000001-0001-0001-0001-000000000001', '[user_id_from_auth]', 'owner')
-- on conflict (org_id, user_id) do update
--   set role = excluded.role;

-- ============================================================================
-- 4. GOOGLE CONNECTIONS
-- ============================================================================
-- Create mock Google OAuth connections for the organizations
-- Note: refresh_token_enc should be encrypted in production

insert into connections_google (id, org_id, account_id, refresh_token_enc, scopes, created_at)
values
  (
    '00000011-0011-0011-0011-000000000011',
    '00000001-0001-0001-0001-000000000001',
    'accounts/123456789',
    'encrypted_refresh_token_acme_123',
    array['https://www.googleapis.com/auth/business.manage']::text[],
    now() - interval '85 days'
  ),
  (
    '00000012-0012-0012-0012-000000000012',
    '00000002-0002-0002-0002-000000000002',
    'accounts/987654321',
    'encrypted_refresh_token_digital_456',
    array['https://www.googleapis.com/auth/business.manage']::text[],
    now() - interval '115 days'
  )
on conflict (org_id, account_id) do update
  set refresh_token_enc = excluded.refresh_token_enc,
      scopes = excluded.scopes;

-- ============================================================================
-- 5. GBP ACCOUNTS
-- ============================================================================
-- Create Google Business Profile accounts for each org

insert into gbp_accounts (id, org_id, google_account_name, display_name, created_at)
values
  (
    '00000021-0021-0021-0021-000000000021',
    '00000001-0001-0001-0001-000000000001',
    'accounts/123456789',
    'Acme Coffee Corporation',
    now() - interval '85 days'
  ),
  (
    '00000022-0022-0022-0022-000000000022',
    '00000002-0002-0002-0002-000000000002',
    'accounts/987654321',
    'Digital Solutions Marketing',
    now() - interval '115 days'
  )
on conflict (org_id, google_account_name) do update
  set display_name = excluded.display_name;

-- ============================================================================
-- 6. GBP LOCATIONS
-- ============================================================================
-- Create multiple locations for each account

insert into gbp_locations (id, org_id, account_id, google_location_name, title, is_managed, meta, sync_state, created_at)
values
  -- Acme Coffee locations
  (
    '00000031-0031-0031-0031-000000000031',
    '00000001-0001-0001-0001-000000000001',
    '00000021-0021-0021-0021-000000000021',
    'locations/12345678901234567',
    'Acme Coffee - Downtown',
    true,
    jsonb_build_object(
      'address', '123 Main St, San Francisco, CA 94102',
      'phone', '+14155551234',
      'categories', array['Coffee Shop', 'Cafe'],
      'website', 'https://acmecoffee.example.com/downtown'
    ),
    jsonb_build_object(
      'last_sync', now() - interval '2 hours',
      'status', 'active'
    ),
    now() - interval '85 days'
  ),
  (
    '00000032-0032-0032-0032-000000000032',
    '00000001-0001-0001-0001-000000000001',
    '00000021-0021-0021-0021-000000000021',
    'locations/12345678901234568',
    'Acme Coffee - Marina',
    true,
    jsonb_build_object(
      'address', '456 Marina Blvd, San Francisco, CA 94123',
      'phone', '+14155555678',
      'categories', array['Coffee Shop', 'Bakery'],
      'website', 'https://acmecoffee.example.com/marina'
    ),
    jsonb_build_object(
      'last_sync', now() - interval '3 hours',
      'status', 'active'
    ),
    now() - interval '80 days'
  ),
  (
    '00000033-0033-0033-0033-000000000033',
    '00000001-0001-0001-0001-000000000001',
    '00000021-0021-0021-0021-000000000021',
    'locations/12345678901234569',
    'Acme Coffee - Mission',
    false,
    jsonb_build_object(
      'address', '789 Mission St, San Francisco, CA 94103',
      'phone', '+14155559012',
      'categories', array['Coffee Shop'],
      'website', 'https://acmecoffee.example.com/mission'
    ),
    jsonb_build_object(
      'last_sync', now() - interval '1 day',
      'status', 'paused'
    ),
    now() - interval '60 days'
  ),
  -- Digital Solutions client locations
  (
    '00000034-0034-0034-0034-000000000034',
    '00000002-0002-0002-0002-000000000002',
    '00000022-0022-0022-0022-000000000022',
    'locations/98765432109876543',
    'City Dental Care',
    true,
    jsonb_build_object(
      'address', '555 Oak Ave, Oakland, CA 94612',
      'phone', '+15105551111',
      'categories', array['Dentist', 'Cosmetic Dentist'],
      'website', 'https://citydentalcare.example.com'
    ),
    jsonb_build_object(
      'last_sync', now() - interval '1 hour',
      'status', 'active'
    ),
    now() - interval '110 days'
  ),
  (
    '00000035-0035-0035-0035-000000000035',
    '00000002-0002-0002-0002-000000000002',
    '00000022-0022-0022-0022-000000000022',
    'locations/98765432109876544',
    'Bay Area Plumbing',
    true,
    jsonb_build_object(
      'address', '321 Industrial Way, San Jose, CA 95110',
      'phone', '+14085552222',
      'categories', array['Plumber', 'Emergency Service'],
      'website', 'https://bayareaplumbing.example.com'
    ),
    jsonb_build_object(
      'last_sync', now() - interval '30 minutes',
      'status', 'active'
    ),
    now() - interval '100 days'
  )
on conflict (org_id, google_location_name) do update
  set title = excluded.title,
      is_managed = excluded.is_managed,
      meta = excluded.meta,
      sync_state = excluded.sync_state;

-- ============================================================================
-- 7. GBP REVIEWS
-- ============================================================================
-- Create sample reviews with various ratings and states

insert into gbp_reviews (id, org_id, location_id, review_id, author, rating, text, reply, state, created_at)
values
  -- Downtown location reviews
  (
    '00000041-0041-0041-0041-000000000041',
    '00000001-0001-0001-0001-000000000001',
    '00000031-0031-0031-0031-000000000031',
    'review_downtown_001',
    'Sarah Mitchell',
    5,
    'Best coffee in the city! The baristas are always friendly and the atmosphere is perfect for working. Highly recommend the caramel latte.',
    'Thank you so much, Sarah! We''re thrilled you enjoyed your experience. See you soon!',
    'replied',
    now() - interval '5 days'
  ),
  (
    '00000042-0042-0042-0042-000000000042',
    '00000001-0001-0001-0001-000000000001',
    '00000031-0031-0031-0031-000000000031',
    'review_downtown_002',
    'Mike Johnson',
    4,
    'Great coffee and pastries. Can get crowded during morning rush but worth the wait.',
    null,
    'pending',
    now() - interval '2 days'
  ),
  (
    '00000043-0043-0043-0043-000000000043',
    '00000001-0001-0001-0001-000000000001',
    '00000031-0031-0031-0031-000000000031',
    'review_downtown_003',
    'Emily Chen',
    2,
    'Coffee was okay but service was slow. They forgot my order twice.',
    null,
    'pending',
    now() - interval '1 day'
  ),
  -- Marina location reviews
  (
    '00000044-0044-0044-0044-000000000044',
    '00000001-0001-0001-0001-000000000001',
    '00000032-0032-0032-0032-000000000032',
    'review_marina_001',
    'David Park',
    5,
    'Love this location! Great view and the fresh pastries are amazing. My go-to spot every weekend.',
    'Thanks David! Your support means the world to us!',
    'replied',
    now() - interval '7 days'
  ),
  (
    '00000045-0045-0045-0045-000000000045',
    '00000001-0001-0001-0001-000000000001',
    '00000032-0032-0032-0032-000000000032',
    'review_marina_002',
    'Lisa Anderson',
    1,
    'Terrible experience. Rude staff and overpriced drinks. Won''t be coming back.',
    null,
    'pending',
    now() - interval '3 hours'
  ),
  -- City Dental reviews
  (
    '00000046-0046-0046-0046-000000000046',
    '00000002-0002-0002-0002-000000000002',
    '00000034-0034-0034-0034-000000000034',
    'review_dental_001',
    'Robert Williams',
    5,
    'Dr. Smith is fantastic! Very gentle and professional. The whole team made me feel comfortable.',
    'Thank you for your kind words, Robert! We''re here whenever you need us.',
    'replied',
    now() - interval '10 days'
  ),
  (
    '00000047-0047-0047-0047-000000000047',
    '00000002-0002-0002-0002-000000000002',
    '00000034-0034-0034-0034-000000000034',
    'review_dental_002',
    'Jennifer Lopez',
    4,
    'Good service but parking is difficult. Great dental work though!',
    null,
    'pending',
    now() - interval '4 days'
  ),
  -- Bay Area Plumbing reviews
  (
    '00000048-0048-0048-0048-000000000048',
    '00000002-0002-0002-0002-000000000002',
    '00000035-0035-0035-0035-000000000035',
    'review_plumbing_001',
    'Tom Martinez',
    5,
    'Called them for an emergency leak at 10pm. They came within 30 minutes and fixed everything. Lifesavers!',
    'Happy to help, Tom! We''re available 24/7 for emergencies.',
    'replied',
    now() - interval '12 days'
  ),
  (
    '00000049-0049-0049-0049-000000000049',
    '00000002-0002-0002-0002-000000000002',
    '00000035-0035-0035-0035-000000000035',
    'review_plumbing_002',
    'Amanda White',
    3,
    'Fixed the problem but charged more than the estimate. Work was good though.',
    null,
    'pending',
    now() - interval '6 days'
  )
on conflict (org_id, review_id) do update
  set author = excluded.author,
      rating = excluded.rating,
      text = excluded.text,
      reply = excluded.reply,
      state = excluded.state;

-- ============================================================================
-- 8. GBP Q&A
-- ============================================================================
-- Create sample questions and answers

insert into gbp_qna (id, org_id, location_id, question_id, question, answer, state, created_at)
values
  -- Downtown location Q&A
  (
    '00000051-0051-0051-0051-000000000051',
    '00000001-0001-0001-0001-000000000001',
    '00000031-0031-0031-0031-000000000031',
    'qna_downtown_001',
    'Do you have WiFi for customers?',
    'Yes! We offer free high-speed WiFi to all our customers. Just ask any barista for the password.',
    'answered',
    now() - interval '20 days'
  ),
  (
    '00000052-0052-0052-0052-000000000052',
    '00000001-0001-0001-0001-000000000001',
    '00000031-0031-0031-0031-000000000031',
    'qna_downtown_002',
    'Are you open on Sundays?',
    'Yes, we''re open 7am-6pm on Sundays!',
    'answered',
    now() - interval '15 days'
  ),
  (
    '00000053-0053-0053-0053-000000000053',
    '00000001-0001-0001-0001-000000000001',
    '00000031-0031-0031-0031-000000000031',
    'qna_downtown_003',
    'Do you serve non-dairy milk alternatives?',
    null,
    'pending',
    now() - interval '2 days'
  ),
  -- Marina location Q&A
  (
    '00000054-0054-0054-0054-000000000054',
    '00000001-0001-0001-0001-000000000001',
    '00000032-0032-0032-0032-000000000032',
    'qna_marina_001',
    'Is there outdoor seating?',
    'Absolutely! We have a beautiful patio with ocean views. Perfect for sunny days!',
    'answered',
    now() - interval '25 days'
  ),
  (
    '00000055-0055-0055-0055-000000000055',
    '00000001-0001-0001-0001-000000000001',
    '00000032-0032-0032-0032-000000000032',
    'qna_marina_002',
    'Do you take reservations for groups?',
    null,
    'pending',
    now() - interval '1 day'
  ),
  -- City Dental Q&A
  (
    '00000056-0056-0056-0056-000000000056',
    '00000002-0002-0002-0002-000000000002',
    '00000034-0034-0034-0034-000000000034',
    'qna_dental_001',
    'Do you accept insurance?',
    'Yes, we accept most major dental insurance plans. Please call us to verify your specific plan.',
    'answered',
    now() - interval '30 days'
  ),
  (
    '00000057-0057-0057-0057-000000000057',
    '00000002-0002-0002-0002-000000000002',
    '00000034-0034-0034-0034-000000000034',
    'qna_dental_002',
    'Do you offer emergency dental services?',
    null,
    'pending',
    now() - interval '5 days'
  ),
  -- Bay Area Plumbing Q&A
  (
    '00000058-0058-0058-0058-000000000058',
    '00000002-0002-0002-0002-000000000002',
    '00000035-0035-0035-0035-000000000035',
    'qna_plumbing_001',
    'Are you available 24/7?',
    'Yes! We provide 24/7 emergency plumbing services throughout the Bay Area.',
    'answered',
    now() - interval '18 days'
  ),
  (
    '00000059-0059-0059-0059-000000000059',
    '00000002-0002-0002-0002-000000000002',
    '00000035-0035-0035-0035-000000000035',
    'qna_plumbing_002',
    'Do you provide free estimates?',
    'Yes, we offer free estimates for all non-emergency work!',
    'answered',
    now() - interval '22 days'
  )
on conflict (org_id, question_id) do update
  set question = excluded.question,
      answer = excluded.answer,
      state = excluded.state;

-- ============================================================================
-- 9. AI GENERATIONS
-- ============================================================================
-- Create sample AI generation records

insert into ai_generations (id, org_id, location_id, kind, input, output, status, model, costs, risk_score, created_at)
values
  (
    '00000061-0061-0061-0061-000000000061',
    '00000001-0001-0001-0001-000000000001',
    '00000031-0031-0031-0031-000000000031',
    'post',
    jsonb_build_object(
      'prompt', 'Create a social post about our new seasonal pumpkin spice latte',
      'context', 'Coffee shop in downtown SF'
    ),
    jsonb_build_object(
      'title', 'Fall Flavors Are Here!',
      'description', 'Cozy up with our new Pumpkin Spice Latte, made with real pumpkin and warming spices. Limited time only! Visit us downtown.',
      'cta', 'Order Now'
    ),
    'completed',
    'gpt-4',
    0.0234,
    0.15,
    now() - interval '8 days'
  ),
  (
    '00000062-0062-0062-0062-000000000062',
    '00000001-0001-0001-0001-000000000001',
    '00000032-0032-0032-0032-000000000032',
    'reply',
    jsonb_build_object(
      'review_text', 'Love this location! Great view and the fresh pastries are amazing.',
      'rating', 5
    ),
    jsonb_build_object(
      'reply', 'Thank you so much for your kind words! We''re thrilled you enjoyed our pastries and the view. Hope to see you again soon!'
    ),
    'completed',
    'gpt-4',
    0.0089,
    0.08,
    now() - interval '7 days'
  ),
  (
    '00000063-0063-0063-0063-000000000063',
    '00000001-0001-0001-0001-000000000001',
    '00000031-0031-0031-0031-000000000031',
    'qna',
    jsonb_build_object(
      'question', 'Do you serve non-dairy milk alternatives?'
    ),
    jsonb_build_object(
      'answer', 'Yes! We offer oat milk, almond milk, and soy milk as non-dairy alternatives for all our drinks.'
    ),
    'pending',
    'gpt-4',
    0.0067,
    0.12,
    now() - interval '2 days'
  ),
  (
    '00000064-0064-0064-0064-000000000064',
    '00000002-0002-0002-0002-000000000002',
    '00000034-0034-0034-0034-000000000034',
    'post',
    jsonb_build_object(
      'prompt', 'Create a post about our teeth whitening special',
      'context', 'Dental practice in Oakland'
    ),
    null,
    'failed',
    'gpt-4',
    0.0015,
    null,
    now() - interval '3 days'
  )
on conflict do nothing;

-- ============================================================================
-- 10. POST CANDIDATES
-- ============================================================================
-- Create sample post candidates in various states

insert into post_candidates (id, org_id, location_id, generation_id, schema, images, status, created_at)
values
  (
    '00000071-0071-0071-0071-000000000071',
    '00000001-0001-0001-0001-000000000001',
    '00000031-0031-0031-0031-000000000031',
    '00000061-0061-0061-0061-000000000061',
    jsonb_build_object(
      'type', 'WHATS_NEW',
      'title', 'Fall Flavors Are Here!',
      'description', 'Cozy up with our new Pumpkin Spice Latte, made with real pumpkin and warming spices. Limited time only! Visit us downtown.',
      'cta', jsonb_build_object('action', 'ORDER', 'url', 'https://acmecoffee.example.com/order')
    ),
    array['https://example.com/images/psl-1.jpg']::text[],
    'approved',
    now() - interval '8 days'
  ),
  (
    '00000072-0072-0072-0072-000000000072',
    '00000001-0001-0001-0001-000000000001',
    '00000032-0032-0032-0032-000000000032',
    null,
    jsonb_build_object(
      'type', 'EVENT',
      'title', 'Live Music This Saturday!',
      'description', 'Join us for an evening of acoustic music and great coffee. Local artist Sarah Jones performs 7-9pm.',
      'startDate', (now() + interval '3 days')::text,
      'endDate', (now() + interval '3 days' + interval '2 hours')::text
    ),
    array[]::text[],
    'pending',
    now() - interval '5 days'
  ),
  (
    '00000073-0073-0073-0073-000000000073',
    '00000001-0001-0001-0001-000000000001',
    '00000031-0031-0031-0031-000000000031',
    null,
    jsonb_build_object(
      'type', 'OFFER',
      'title', 'Happy Hour Special',
      'description', 'Buy one coffee, get one 50% off! Valid 3-5pm daily.',
      'couponCode', 'HAPPY50',
      'redeemOnlineUrl', 'https://acmecoffee.example.com/offers'
    ),
    array['https://example.com/images/happy-hour.jpg']::text[],
    'draft',
    now() - interval '3 days'
  ),
  (
    '00000074-0074-0074-0074-000000000074',
    '00000002-0002-0002-0002-000000000002',
    '00000034-0034-0034-0034-000000000034',
    null,
    jsonb_build_object(
      'type', 'WHATS_NEW',
      'title', 'Now Accepting New Patients',
      'description', 'City Dental Care is welcoming new patients! Schedule your first visit today and receive a free consultation.',
      'cta', jsonb_build_object('action', 'BOOK', 'url', 'https://citydentalcare.example.com/book')
    ),
    array[]::text[],
    'rejected',
    now() - interval '10 days'
  )
on conflict do nothing;

-- ============================================================================
-- 11. SCHEDULES
-- ============================================================================
-- Create sample scheduled posts

insert into schedules (id, org_id, location_id, target_type, target_id, publish_at, status, provider_ref, created_at)
values
  (
    '00000081-0081-0081-0081-000000000081',
    '00000001-0001-0001-0001-000000000001',
    '00000031-0031-0031-0031-000000000031',
    'post_candidate',
    '00000071-0071-0071-0071-000000000071',
    now() - interval '7 days',
    'published',
    'gbp_post_abc123xyz',
    now() - interval '8 days'
  ),
  (
    '00000082-0082-0082-0082-000000000082',
    '00000001-0001-0001-0001-000000000001',
    '00000032-0032-0032-0032-000000000032',
    'post_candidate',
    '00000072-0072-0072-0072-000000000072',
    now() + interval '3 days' + interval '7 hours',
    'pending',
    null,
    now() - interval '5 days'
  ),
  (
    '00000083-0083-0083-0083-000000000083',
    '00000001-0001-0001-0001-000000000001',
    '00000031-0031-0031-0031-000000000031',
    'post_candidate',
    '00000073-0073-0073-0073-000000000073',
    now() + interval '1 day' + interval '15 hours',
    'pending',
    null,
    now() - interval '3 days'
  )
on conflict do nothing;

-- ============================================================================
-- 12. AUTOMATION POLICIES
-- ============================================================================
-- Create automation policies for different content types

insert into automation_policies (id, org_id, location_id, content_type, mode, max_per_week, quiet_hours, risk_threshold, require_disclaimers, delete_window_sec, created_at)
values
  -- Acme Coffee Downtown - Posts on auto-create
  (
    '00000091-0091-0091-0091-000000000091',
    '00000001-0001-0001-0001-000000000001',
    '00000031-0031-0031-0031-000000000031',
    'post',
    'auto_create',
    5,
    jsonb_build_object(
      'timezone', 'America/Los_Angeles',
      'ranges', jsonb_build_array(
        jsonb_build_object('start', '22:00', 'end', '08:00')
      )
    ),
    0.30,
    false,
    0,
    now() - interval '80 days'
  ),
  -- Acme Coffee Downtown - Q&A on auto-create
  (
    '00000092-0092-0092-0092-000000000092',
    '00000001-0001-0001-0001-000000000001',
    '00000031-0031-0031-0031-000000000031',
    'qna',
    'auto_create',
    10,
    jsonb_build_object('timezone', 'America/Los_Angeles'),
    0.20,
    false,
    0,
    now() - interval '80 days'
  ),
  -- Acme Coffee Downtown - Review replies on autopilot
  (
    '00000093-0093-0093-0093-000000000093',
    '00000001-0001-0001-0001-000000000001',
    '00000031-0031-0031-0031-000000000031',
    'reply',
    'autopilot',
    20,
    jsonb_build_object('timezone', 'America/Los_Angeles'),
    0.40,
    true,
    86400,
    now() - interval '80 days'
  ),
  -- Acme Coffee Marina - Posts off
  (
    '00000094-0094-0094-0094-000000000094',
    '00000001-0001-0001-0001-000000000001',
    '00000032-0032-0032-0032-000000000032',
    'post',
    'off',
    5,
    jsonb_build_object('timezone', 'America/Los_Angeles'),
    0.30,
    false,
    0,
    now() - interval '75 days'
  ),
  -- City Dental - Posts on auto-create with high safety
  (
    '00000095-0095-0095-0095-000000000095',
    '00000002-0002-0002-0002-000000000002',
    '00000034-0034-0034-0034-000000000034',
    'post',
    'auto_create',
    3,
    jsonb_build_object(
      'timezone', 'America/Los_Angeles',
      'ranges', jsonb_build_array(
        jsonb_build_object('start', '20:00', 'end', '09:00')
      )
    ),
    0.15,
    true,
    0,
    now() - interval '105 days'
  ),
  -- City Dental - Review replies on autopilot
  (
    '00000096-0096-0096-0096-000000000096',
    '00000002-0002-0002-0002-000000000002',
    '00000034-0034-0034-0034-000000000034',
    'reply',
    'autopilot',
    30,
    jsonb_build_object('timezone', 'America/Los_Angeles'),
    0.25,
    true,
    172800,
    now() - interval '105 days'
  ),
  -- Bay Area Plumbing - All automation off
  (
    '00000097-0097-0097-0097-000000000097',
    '00000002-0002-0002-0002-000000000002',
    '00000035-0035-0035-0035-000000000035',
    'post',
    'off',
    7,
    jsonb_build_object('timezone', 'America/Los_Angeles'),
    0.30,
    false,
    0,
    now() - interval '95 days'
  )
on conflict (org_id, location_id, content_type) do update
  set mode = excluded.mode,
      max_per_week = excluded.max_per_week,
      quiet_hours = excluded.quiet_hours,
      risk_threshold = excluded.risk_threshold,
      require_disclaimers = excluded.require_disclaimers,
      delete_window_sec = excluded.delete_window_sec;

-- ============================================================================
-- 13. SAFETY RULES
-- ============================================================================
-- Create organization-level safety rules

insert into safety_rules (id, org_id, banned_terms, required_phrases, blocked_categories, created_at)
values
  (
    '000000a1-00a1-00a1-00a1-0000000000a1',
    '00000001-0001-0001-0001-000000000001',
    array[
      'spam', 'scam', 'viagra', 'click here', 'limited time only',
      'act now', 'free money', 'guarantee', 'lawsuit', 'lawyer'
    ]::text[],
    array[
      'Acme Coffee'
    ]::text[],
    array[
      'violence',
      'hate',
      'adult',
      'political'
    ]::text[],
    now() - interval '85 days'
  ),
  (
    '000000a2-00a2-00a2-00a2-0000000000a2',
    '00000002-0002-0002-0002-000000000002',
    array[
      'spam', 'scam', 'guaranteed cure', 'miracle', 'instant results',
      'FDA', 'medical advice', 'diagnosis', 'treatment plan'
    ]::text[],
    array[
      'consult your healthcare provider',
      'professional dental care'
    ]::text[],
    array[
      'violence',
      'hate',
      'adult',
      'political',
      'medical_claims'
    ]::text[],
    now() - interval '115 days'
  )
on conflict (org_id) do update
  set banned_terms = excluded.banned_terms,
      required_phrases = excluded.required_phrases,
      blocked_categories = excluded.blocked_categories;

-- ============================================================================
-- 14. AUDIT LOGS
-- ============================================================================
-- Create sample audit log entries
-- Note: actor_id will be null until users are created in auth.users

insert into audit_logs (id, org_id, actor_id, action, target, meta, created_at)
values
  (
    '000000b1-00b1-00b1-00b1-0000000000b1',
    '00000001-0001-0001-0001-000000000001',
    null,
    'location.connected',
    '00000031-0031-0031-0031-000000000031',
    jsonb_build_object(
      'location_name', 'Acme Coffee - Downtown',
      'account_id', '00000021-0021-0021-0021-000000000021'
    ),
    now() - interval '85 days'
  ),
  (
    '000000b2-00b2-00b2-00b2-0000000000b2',
    '00000001-0001-0001-0001-000000000001',
    null,
    'automation_policy.updated',
    '00000091-0091-0091-0091-000000000091',
    jsonb_build_object(
      'location_id', '00000031-0031-0031-0031-000000000031',
      'content_type', 'post',
      'old_mode', 'off',
      'new_mode', 'auto_create'
    ),
    now() - interval '80 days'
  ),
  (
    '000000b3-00b3-00b3-00b3-0000000000b3',
    '00000001-0001-0001-0001-000000000001',
    null,
    'post.published',
    '00000071-0071-0071-0071-000000000071',
    jsonb_build_object(
      'location_id', '00000031-0031-0031-0031-000000000031',
      'schedule_id', '00000081-0081-0081-0081-000000000081',
      'provider_ref', 'gbp_post_abc123xyz'
    ),
    now() - interval '7 days'
  ),
  (
    '000000b4-00b4-00b4-00b4-0000000000b4',
    '00000001-0001-0001-0001-000000000001',
    null,
    'review.replied',
    '00000041-0041-0041-0041-000000000041',
    jsonb_build_object(
      'location_id', '00000031-0031-0031-0031-000000000031',
      'review_rating', 5,
      'automated', true
    ),
    now() - interval '5 days'
  ),
  (
    '000000b5-00b5-00b5-00b5-0000000000b5',
    '00000002-0002-0002-0002-000000000002',
    null,
    'safety_rules.updated',
    '000000a2-00a2-00a2-00a2-0000000000a2',
    jsonb_build_object(
      'added_terms', array['medical advice', 'diagnosis'],
      'reason', 'Healthcare compliance requirements'
    ),
    now() - interval '30 days'
  )
on conflict do nothing;

-- Commit transaction
commit;

-- ============================================================================
-- SETUP INSTRUCTIONS
-- ============================================================================
-- After running this seed file, complete the following steps:
--
-- 1. Create test user via Supabase Auth:
--    supabase auth signup --email jasonfreynolds@gmail.com --password thematrix
--
-- 2. Get the user UUID from auth.users:
--    select id from auth.users where email = 'jasonfreynolds@gmail.com';
--
-- 3. Link the user to the users table and org:
--    insert into users (id, email, name) values ('[user_id]', 'jasonfreynolds@gmail.com', 'Jason Reynolds');
--    insert into org_members (org_id, user_id, role) values ('00000001-0001-0001-0001-000000000001', '[user_id]', 'owner');
--
-- 4. (Optional) Create additional test users for the second org:
--    supabase auth signup --email admin@digitalsolutions.test --password testpass123
--    insert into users (id, email, name) values ('[user_id]', 'admin@digitalsolutions.test', 'Admin User');
--    insert into org_members (org_id, user_id, role) values ('00000002-0002-0002-0002-000000000002', '[user_id]', 'admin');
--
-- 5. Verify the seed data:
--    select count(*) from orgs; -- Should be 2
--    select count(*) from gbp_locations; -- Should be 5
--    select count(*) from gbp_reviews; -- Should be 9
--    select count(*) from automation_policies; -- Should be 7
--
-- ============================================================================
