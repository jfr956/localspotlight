# Seed Data Documentation

This document describes the test data available in the local development database and how to use it.

## Quick Start

### 1. Apply Seed Data

```bash
# Method 1: Using the helper script (recommended)
./scripts/seed-db.sh

# Method 2: Via Supabase CLI (applies migrations + seed)
supabase db reset

# Method 3: Manual psql
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/seed.sql
```

### 2. Create Test User

```bash
# Create user via Supabase Auth
supabase auth signup --email jasonfreynolds@gmail.com --password thematrix

# Get the user ID
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  -c "SELECT id FROM auth.users WHERE email = 'jasonfreynolds@gmail.com';"

# Link user to users table and assign to org (replace [user_id] with actual UUID)
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres <<EOF
INSERT INTO users (id, email, name)
VALUES ('[user_id]', 'jasonfreynolds@gmail.com', 'Jason Reynolds');

INSERT INTO org_members (org_id, user_id, role)
VALUES ('00000001-0001-0001-0001-000000000001', '[user_id]', 'owner');
EOF
```

## Test Credentials

### Primary Test Account
- **Email**: jasonfreynolds@gmail.com
- **Password**: thematrix
- **Role**: owner
- **Organization**: Acme Coffee Shops (Pro plan)
- **Org ID**: `00000001-0001-0001-0001-000000000001`

### Secondary Test Account (Optional)
- **Email**: admin@digitalsolutions.test
- **Password**: (Create via Supabase Auth)
- **Role**: admin
- **Organization**: Digital Solutions Agency (Enterprise plan)
- **Org ID**: `00000002-0002-0002-0002-000000000002`

## Seed Data Overview

### Organizations (2)

#### 1. Acme Coffee Shops
- **ID**: `00000001-0001-0001-0001-000000000001`
- **Plan**: Pro
- **Locations**: 3 coffee shops in San Francisco
- **Created**: 90 days ago

#### 2. Digital Solutions Agency
- **ID**: `00000002-0002-0002-0002-000000000002`
- **Plan**: Enterprise
- **Locations**: 2 client locations (dental + plumbing)
- **Created**: 120 days ago

### GBP Locations (5)

#### Acme Coffee Locations

1. **Acme Coffee - Downtown**
   - **ID**: `00000031-0031-0031-0031-000000000031`
   - **Managed**: Yes
   - **Address**: 123 Main St, San Francisco, CA 94102
   - **Status**: Active
   - **Reviews**: 3 (5-star, 4-star, 2-star)
   - **Q&A**: 3 questions (2 answered, 1 pending)
   - **Automation**: Posts (auto-create), Q&A (auto-create), Replies (autopilot)

2. **Acme Coffee - Marina**
   - **ID**: `00000032-0032-0032-0032-000000000032`
   - **Managed**: Yes
   - **Address**: 456 Marina Blvd, San Francisco, CA 94123
   - **Status**: Active
   - **Reviews**: 2 (5-star, 1-star)
   - **Q&A**: 2 questions (1 answered, 1 pending)
   - **Automation**: Posts (off)

3. **Acme Coffee - Mission**
   - **ID**: `00000033-0033-0033-0033-000000000033`
   - **Managed**: No
   - **Address**: 789 Mission St, San Francisco, CA 94103
   - **Status**: Paused
   - **Reviews**: None
   - **Q&A**: None

#### Digital Solutions Client Locations

4. **City Dental Care**
   - **ID**: `00000034-0034-0034-0034-000000000034`
   - **Managed**: Yes
   - **Address**: 555 Oak Ave, Oakland, CA 94612
   - **Status**: Active
   - **Reviews**: 2 (5-star, 4-star)
   - **Q&A**: 2 questions (1 answered, 1 pending)
   - **Automation**: Posts (auto-create, strict safety), Replies (autopilot)

5. **Bay Area Plumbing**
   - **ID**: `00000035-0035-0035-0035-000000000035`
   - **Managed**: Yes
   - **Address**: 321 Industrial Way, San Jose, CA 95110
   - **Status**: Active
   - **Reviews**: 2 (5-star, 3-star)
   - **Q&A**: 2 questions (both answered)
   - **Automation**: All off

### Reviews (9 total)

Ratings distribution:
- 5-star: 4 reviews (3 replied, 1 pending)
- 4-star: 2 reviews (both pending)
- 3-star: 1 review (pending)
- 2-star: 1 review (pending)
- 1-star: 1 review (pending)

**States**:
- Replied: 4 reviews
- Pending: 5 reviews (need responses)

### Questions & Answers (9 total)

**States**:
- Answered: 6 questions
- Pending: 3 questions (need answers)

### AI Generations (4)

1. **Pumpkin Spice Latte Post** (completed, risk: 0.15)
2. **Review Reply** (completed, risk: 0.08)
3. **Non-dairy Milk Q&A** (pending, risk: 0.12)
4. **Dental Whitening Post** (failed)

### Post Candidates (4)

1. **Fall Flavors PSL** - Approved, scheduled and published
2. **Live Music Event** - Pending, scheduled for 3 days from now
3. **Happy Hour Offer** - Draft, scheduled for tomorrow
4. **New Patients** - Rejected

### Schedules (3)

1. **Published**: Pumpkin Spice Latte post (7 days ago)
2. **Pending**: Live Music event (in 3 days)
3. **Pending**: Happy Hour offer (tomorrow)

### Automation Policies (7)

Different automation modes configured:
- **auto_create**: Content is generated but requires approval
- **autopilot**: Content is generated and published automatically
- **off**: No automation

Risk thresholds vary:
- Dental: 0.15 (very conservative)
- Coffee posts: 0.30 (moderate)
- Review replies: 0.25-0.40 (higher tolerance)

### Safety Rules (2)

#### Acme Coffee Rules
**Banned Terms**: spam, scam, viagra, click here, limited time only, act now, free money, guarantee, lawsuit, lawyer
**Required Phrases**: Acme Coffee
**Blocked Categories**: violence, hate, adult, political

#### Digital Solutions Rules (Healthcare Compliance)
**Banned Terms**: spam, scam, guaranteed cure, miracle, instant results, FDA, medical advice, diagnosis, treatment plan
**Required Phrases**: consult your healthcare provider, professional dental care
**Blocked Categories**: violence, hate, adult, political, medical_claims

### Audit Logs (5)

Sample activities logged:
- Location connected
- Automation policy updated
- Post published
- Review replied
- Safety rules updated

## Testing Scenarios

### 1. Test Review Reply Automation

```sql
-- View pending reviews
SELECT r.id, l.title as location, r.author, r.rating, r.text
FROM gbp_reviews r
JOIN gbp_locations l ON r.location_id = l.id
WHERE r.state = 'pending'
ORDER BY r.created_at DESC;

-- Check automation policy for replies
SELECT l.title, ap.mode, ap.risk_threshold, ap.require_disclaimers
FROM automation_policies ap
JOIN gbp_locations l ON ap.location_id = l.id
WHERE ap.content_type = 'reply';
```

### 2. Test Post Generation

```sql
-- View post candidates
SELECT pc.id, l.title as location, pc.schema->>'type' as type,
       pc.schema->>'title' as post_title, pc.status
FROM post_candidates pc
JOIN gbp_locations l ON pc.location_id = l.id
ORDER BY pc.created_at DESC;

-- View scheduled posts
SELECT s.id, l.title as location, s.publish_at, s.status,
       pc.schema->>'title' as post_title
FROM schedules s
JOIN gbp_locations l ON s.location_id = l.id
LEFT JOIN post_candidates pc ON s.target_id = pc.id
WHERE s.target_type = 'post_candidate'
ORDER BY s.publish_at;
```

### 3. Test Safety Rules

```sql
-- View organization safety rules
SELECT o.name,
       sr.banned_terms,
       sr.required_phrases,
       sr.blocked_categories
FROM safety_rules sr
JOIN orgs o ON sr.org_id = o.id;
```

### 4. Test Org Isolation (RLS)

```sql
-- This should only return data for the logged-in user's org
SELECT l.title, l.is_managed, l.meta->>'address' as address
FROM gbp_locations l
WHERE l.org_id IN (
  SELECT org_id FROM org_members WHERE user_id = auth.uid()
);
```

## Data Statistics

Run this query to get a complete overview:

```sql
SELECT
  'Organizations' as entity, COUNT(*)::text FROM orgs
UNION ALL
SELECT 'GBP Accounts', COUNT(*)::text FROM gbp_accounts
UNION ALL
SELECT 'GBP Locations', COUNT(*)::text FROM gbp_locations
UNION ALL
SELECT 'GBP Reviews', COUNT(*)::text FROM gbp_reviews
UNION ALL
SELECT 'GBP Q&A', COUNT(*)::text FROM gbp_qna
UNION ALL
SELECT 'AI Generations', COUNT(*)::text FROM ai_generations
UNION ALL
SELECT 'Post Candidates', COUNT(*)::text FROM post_candidates
UNION ALL
SELECT 'Schedules', COUNT(*)::text FROM schedules
UNION ALL
SELECT 'Automation Policies', COUNT(*)::text FROM automation_policies
UNION ALL
SELECT 'Safety Rules', COUNT(*)::text FROM safety_rules
UNION ALL
SELECT 'Audit Logs', COUNT(*)::text FROM audit_logs;
```

Expected results:
- Organizations: 2 (or more if you have existing data)
- GBP Accounts: 2
- GBP Locations: 5
- GBP Reviews: 9
- GBP Q&A: 9
- AI Generations: 4
- Post Candidates: 4
- Schedules: 3
- Automation Policies: 7
- Safety Rules: 2
- Audit Logs: 5

## Resetting the Database

To start fresh:

```bash
# Reset database (runs all migrations and seed.sql)
supabase db reset

# Or just reapply seed data
./scripts/seed-db.sh
```

## Common Issues

### Issue: User not linked to organization

**Symptom**: Can't see any locations or data after logging in

**Solution**:
```sql
-- Check if user exists
SELECT id, email FROM auth.users WHERE email = 'jasonfreynolds@gmail.com';

-- Check if user is in users table
SELECT * FROM users WHERE email = 'jasonfreynolds@gmail.com';

-- Check org membership
SELECT om.*, o.name
FROM org_members om
JOIN orgs o ON om.org_id = o.id
WHERE om.user_id = '[user_id]';

-- Fix: Link user to org (replace [user_id])
INSERT INTO users (id, email, name)
VALUES ('[user_id]', 'jasonfreynolds@gmail.com', 'Jason Reynolds')
ON CONFLICT (id) DO NOTHING;

INSERT INTO org_members (org_id, user_id, role)
VALUES ('00000001-0001-0001-0001-000000000001', '[user_id]', 'owner')
ON CONFLICT (org_id, user_id) DO UPDATE SET role = excluded.role;
```

### Issue: Seed data already exists

**Symptom**: Duplicate key errors or "already exists" messages

**Solution**: The seed file is idempotent. It uses `ON CONFLICT` clauses to update existing records. Just run it again - it will update the data.

### Issue: Foreign key constraint errors

**Symptom**: Can't insert data due to missing references

**Solution**: Ensure migrations have been run first:
```bash
supabase db reset  # This runs migrations before seed
```

## Key UUID References

For quick reference when writing tests or making manual changes:

### Organizations
- Acme Coffee: `00000001-0001-0001-0001-000000000001`
- Digital Solutions: `00000002-0002-0002-0002-000000000002`

### Locations
- Acme Downtown: `00000031-0031-0031-0031-000000000031`
- Acme Marina: `00000032-0032-0032-0032-000000000032`
- Acme Mission: `00000033-0033-0033-0033-000000000033`
- City Dental: `00000034-0034-0034-0034-000000000034`
- Bay Area Plumbing: `00000035-0035-0035-0035-000000000035`

## Additional Resources

- **Seed File**: `/supabase/seed.sql`
- **Seed Script**: `/scripts/seed-db.sh`
- **Migrations**: `/supabase/migrations/`
- **Supabase Docs**: https://supabase.com/docs
