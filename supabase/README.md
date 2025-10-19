## Supabase Workspace

LocalSpotlight uses Supabase as its database, authentication, and storage backend. This directory contains all database-related files for local development and cloud deployment.

### Directory Structure

- `migrations/`: SQL migrations and seed scripts managed via the Supabase CLI.
- `tests/`: Automated RLS and integration tests executed against a local Supabase stack.
- `config.toml`: Supabase configuration for local development.
- `seed.sql`: Initial data for local development and testing.

### Quick Start

1. **Start Supabase locally:**

   ```bash
   pnpm db:start
   ```

2. **Copy environment variables** (shown in the output) to `apps/web/.env.local`

3. **Open Supabase Studio:**

   ```bash
   pnpm db:studio
   # or visit http://127.0.0.1:54323
   ```

4. **Generate TypeScript types:**
   ```bash
   pnpm db:types
   ```

### Database Schema

The database uses a **multi-tenant architecture** with complete org-level isolation:

#### Core Tables

- `orgs` - Organizations
- `users` - User profiles (extends auth.users)
- `org_members` - Organization membership with roles

#### Google Business Profile

- `connections_google` - OAuth tokens (encrypted)
- `gbp_accounts` - Google Business accounts
- `gbp_locations` - Business locations
- `gbp_reviews` - Customer reviews
- `gbp_qna` - Questions & answers
- `gbp_media` - Photos and videos

#### AI & Content

- `ai_briefs` - Content briefs with vector embeddings
- `ai_generations` - AI-generated content
- `post_candidates` - Posts awaiting approval
- `schedules` - Publishing schedule

#### Security & Automation

- `automation_policies` - Autopilot settings per org/location
- `safety_rules` - Content moderation rules
- `audit_logs` - Complete audit trail

### Security (Row-Level Security)

**Every table has RLS enabled** with policies that ensure:

- Users can only access data from their organizations
- Role-based permissions (owner, admin, editor, viewer)
- Zero cross-org data leakage
- Service role for system operations

See `tests/rls_test.sql` for verification tests.

### Available Commands

```bash
# Start/stop local Supabase
pnpm db:start
pnpm db:stop

# Reset database (rerun migrations + seed)
pnpm db:reset

# View connection info
pnpm db:status

# Generate TypeScript types
pnpm db:types

# Create a new migration
pnpm db:migrate <migration_name>

# Push migrations to cloud
pnpm db:push
```

### Migrations

Migrations are stored in `migrations/` and run automatically:

1. `20241017000001_initial_schema.sql` - Core tables, indexes, triggers
2. `20241017000002_rls_policies.sql` - Row-level security policies

To create a new migration:

```bash
pnpm db:migrate add_new_feature
# Edit the generated file in migrations/
pnpm db:reset  # Apply locally
```

### Deploying to Cloud

See `../SUPABASE_SETUP.md` for complete migration guide.

Quick version:

```bash
# Login and link to cloud project
supabase login
supabase link --project-ref your-project-ref

# Push migrations
pnpm db:push

# Update environment variables in your hosting platform
```

### Scheduled Jobs

Supabase Cron triggers `/api/automation/generate-posts` daily to queue AI post candidates for managed locations.

1. Set `AUTOMATION_CRON_SECRET` in both `.env.local` and your Supabase project settings.
2. Update the job schedule in `supabase/config.toml` (`[[cron.jobs]]`) if you need a different cadence.
3. Redeploy configuration when the schedule changes: `supabase link` (if needed) then `supabase deploy cron`.

### Resources

- [Main Setup Guide](../SUPABASE_SETUP.md) - Complete installation and migration guide
- [Supabase Docs](https://supabase.com/docs)
- [RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
