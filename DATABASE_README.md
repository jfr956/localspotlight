# LocalSpotlight Database Documentation

## Overview

LocalSpotlight uses **Supabase** (PostgreSQL) for all data storage, authentication, and real-time features. The database is designed with a **local-first development approach** - you develop everything locally using Docker, then seamlessly migrate to Supabase Cloud for production.

## Quick Links

- **Quick Start**: [QUICK_START.md](./QUICK_START.md) - Get running in 5 minutes
- **Full Setup Guide**: [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) - Complete configuration
- **Cloud Migration**: [CLOUD_MIGRATION.md](./CLOUD_MIGRATION.md) - Deploy to production
- **Summary**: [SUPABASE_SUMMARY.md](./SUPABASE_SUMMARY.md) - What's configured

## Architecture

### Multi-Tenant Design

Every table includes an `org_id` column with Row-Level Security (RLS) policies ensuring complete data isolation between organizations.

```
User A (Org 1) ──> Can access ──> Org 1 Data
                ──> BLOCKED ───> Org 2 Data

User B (Org 2) ──> Can access ──> Org 2 Data
                ──> BLOCKED ───> Org 1 Data
```

### Security Model

```
┌─────────────────────────────────────────┐
│          Application Layer              │
│  (Next.js with Supabase Client)        │
└─────────────────┬───────────────────────┘
                  │ All queries
                  ▼
┌─────────────────────────────────────────┐
│     Row-Level Security (RLS)            │
│  Enforced at Database Level             │
│  • Checks auth.uid()                    │
│  • Validates org membership             │
│  • Applies role permissions             │
└─────────────────┬───────────────────────┘
                  │ Filtered results
                  ▼
┌─────────────────────────────────────────┐
│         PostgreSQL Database             │
│  All data stored with org_id            │
└─────────────────────────────────────────┘
```

## Database Schema

### Core Tables

#### Organizations & Users

```sql
orgs                 -- Customer organizations
├── id (uuid)
├── name (text)
└── plan (text)

users                -- User profiles
├── id (uuid) → auth.users
├── email (text)
└── name (text)

org_members          -- Membership & roles
├── org_id → orgs
├── user_id → users
└── role (owner|admin|editor|viewer)
```

#### Google Business Profile

```sql
connections_google   -- OAuth connections
├── org_id → orgs
├── account_id (text)
└── refresh_token_enc (encrypted)

gbp_accounts         -- GBP accounts
├── org_id → orgs
└── google_account_name (text)

gbp_locations        -- Business locations
├── org_id → orgs
├── account_id → gbp_accounts
└── meta (jsonb)

gbp_reviews          -- Customer reviews
├── org_id → orgs
├── location_id → gbp_locations
└── rating, text, reply

gbp_qna              -- Q&A pairs
├── org_id → orgs
├── location_id → gbp_locations
└── question, answer

gbp_media            -- Photos/videos
├── org_id → orgs
├── location_id → gbp_locations
└── url, type
```

#### AI & Content

```sql
ai_briefs            -- Content briefs with RAG
├── org_id → orgs
├── location_id → gbp_locations
├── brief (jsonb)
└── embeddings (vector)  -- pgvector for similarity search

ai_generations       -- AI outputs
├── org_id → orgs
├── location_id → gbp_locations
├── kind (post|qna|reply|image)
├── output (jsonb)
└── risk_score (0-1)

post_candidates      -- Posts awaiting approval
├── org_id → orgs
├── location_id → gbp_locations
├── schema (jsonb)
└── images (text[])

schedules            -- Publishing calendar
├── org_id → orgs
├── location_id → gbp_locations
├── publish_at (timestamptz)
└── status (pending|published|failed)
```

#### Automation & Security

```sql
automation_policies  -- Autopilot settings
├── org_id → orgs
├── location_id → gbp_locations
├── content_type (post|qna|reply)
├── mode (off|auto_create|autopilot)
├── max_per_week (int)
└── risk_threshold (numeric)

safety_rules         -- Content moderation
├── org_id → orgs
├── banned_terms (text[])
├── required_phrases (text[])
└── blocked_categories (text[])

audit_logs           -- Complete audit trail
├── org_id → orgs
├── actor_id → users
├── action (text)
└── meta (jsonb)
```

## Row-Level Security (RLS)

Every table has policies like:

```sql
-- Users can only see data from their orgs
create policy "Users can view their org's data"
  on table_name for select
  using (org_id in (
    select org_id from org_members
    where user_id = auth.uid()
  ));

-- Role-based write access
create policy "Editors can modify data"
  on table_name for update
  using (
    org_id in (select auth.user_org_ids())
    and auth.user_org_role(org_id) in ('owner', 'admin', 'editor')
  );
```

## Vector Embeddings (RAG)

The `ai_briefs` table includes vector embeddings for semantic search:

```sql
-- Find similar content
select * from ai_briefs
where org_id = $1
order by embeddings <=> $2  -- Cosine similarity
limit 5;
```

This enables:

- Grounding AI outputs in past successful content
- Finding similar posts across locations
- Semantic search for Q&A suggestions

## Indexes & Performance

Comprehensive indexes ensure fast queries:

```sql
-- Org filtering (most common query pattern)
create index idx_table_org_id on table(org_id);

-- Time-based queries
create index idx_schedules_publish_at on schedules(publish_at)
  where status = 'pending';

-- Vector similarity search
create index idx_ai_briefs_embeddings on ai_briefs
  using ivfflat (embeddings vector_cosine_ops);
```

## Migrations

### Current Migrations

1. **`20241017000001_initial_schema.sql`**
   - Creates all 16 tables
   - Sets up indexes and triggers
   - Enables pgvector extension
   - Defines custom types/enums

2. **`20241017000002_rls_policies.sql`**
   - Enables RLS on all tables
   - Creates helper functions
   - Defines all security policies
   - Grants appropriate permissions

### Creating New Migrations

```bash
# Create a new migration file
pnpm db:migrate add_feature_name

# Edit the generated file in supabase/migrations/

# Apply locally
pnpm db:reset

# Regenerate types
pnpm db:types
```

### Migration Best Practices

1. **Never edit existing migrations** - Create new ones
2. **Test locally first** - `pnpm db:reset` before pushing
3. **Include rollback steps** in comments
4. **Maintain RLS** on all new tables
5. **Update TypeScript types** after changes

## Local Development

### Starting Supabase

```bash
# First time setup
./scripts/setup-supabase.sh

# Or manually
pnpm db:start
```

This starts:

- PostgreSQL database (port 54322)
- Supabase API (port 54321)
- Supabase Studio (port 54323)
- Email testing (Inbucket, port 54324)

### Connecting to Database

```typescript
// apps/web/src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
```

### TypeScript Types

```bash
# Generate types from database schema
pnpm db:types

# Creates apps/web/src/types/database.ts
```

Usage:

```typescript
import { Database } from "@/types/database";

type Org = Database["public"]["Tables"]["orgs"]["Row"];
type OrgInsert = Database["public"]["Tables"]["orgs"]["Insert"];
type OrgUpdate = Database["public"]["Tables"]["orgs"]["Update"];
```

## Testing

### RLS Tests

```sql
-- supabase/tests/rls_test.sql
-- Tests cross-org isolation
-- Run with: psql postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

### Integration Tests

```typescript
// apps/web/tests/e2e/database.spec.ts
test("users cannot access other org data", async () => {
  // Create User A in Org 1
  // Create User B in Org 2
  // Verify User A cannot see Org 2 data
});
```

## Cloud Migration

### Step-by-Step

1. **Create Supabase project** at https://app.supabase.com
2. **Link local to cloud**: `supabase link --project-ref xxx`
3. **Push migrations**: `pnpm db:push`
4. **Update env vars** in your hosting platform
5. **Deploy application**

See [CLOUD_MIGRATION.md](./CLOUD_MIGRATION.md) for complete guide.

### Environment Variables

```env
# Local Development
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=local-anon-key

# Production
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=cloud-anon-key
SUPABASE_SERVICE_ROLE_KEY=cloud-service-key  # Server-side only
```

## Backup & Restore

### Local Backup

```bash
# Backup local database
pg_dump postgresql://postgres:postgres@127.0.0.1:54322/postgres > backup.sql

# Restore
pnpm db:reset
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres < backup.sql
```

### Cloud Backup

Supabase Pro includes automatic daily backups.

Manual backup:

```bash
supabase db dump --linked -f backup-$(date +%Y%m%d).sql
```

## Monitoring & Performance

### Query Performance

In Supabase Studio:

- **Database → Performance** - View slow queries
- **Database → Roles** - Check connection usage
- **Logs** - View query logs

### Common Optimizations

```sql
-- Add index for common query pattern
create index concurrently idx_table_column on table(column);

-- Analyze query plan
explain analyze
select * from table where condition;

-- Update statistics
analyze table_name;
```

## Security Checklist

- [x] RLS enabled on all tables
- [x] Org-level data isolation
- [x] Role-based permissions
- [x] Encrypted token storage
- [x] Audit logging
- [x] Service role protected
- [x] No hardcoded secrets
- [x] JWT expiry configured
- [x] Rate limiting in place

## Troubleshooting

### Common Issues

**Docker not running**

```bash
# Start Docker Desktop first
open -a Docker
```

**Port conflicts**

```bash
# Check what's using the port
lsof -ti:54321

# Kill the process
lsof -ti:54321 | xargs kill -9
```

**Migration errors**

```bash
# Reset and restart
pnpm db:stop --no-backup
pnpm db:start
```

**RLS blocking queries**

```typescript
// Ensure user is authenticated
const {
  data: { user },
} = await supabase.auth.getUser();

// Check org membership
const { data } = await supabase.from("org_members").select("*").eq("user_id", user.id);
```

## Additional Resources

- **Supabase Docs**: https://supabase.com/docs
- **PostgreSQL Docs**: https://www.postgresql.org/docs/
- **pgvector**: https://github.com/pgvector/pgvector
- **RLS Guide**: https://supabase.com/docs/guides/auth/row-level-security

## Support

For issues specific to this project:

1. Check documentation in this directory
2. Review `.cursor/plans/local-928c70a6.plan.md`
3. See `context/Business Context & Implementation Notes.md`

For Supabase-specific issues:

- Discord: https://discord.supabase.com
- GitHub: https://github.com/supabase/supabase
