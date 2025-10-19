# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LocalSpotlight is a multi-tenant SaaS platform for managing Google Business Profile (GBP) content at scale using AI. It enables agencies to automate GBP posts, review responses, Q&A management, and profile optimization for multiple client organizations and locations.

**Core Value Proposition:** Achieve 25% QoQ uplift in conversion metrics (phone calls, website clicks) through AI-generated, brand-aligned content.

**Primary Spec:** `.cursor/plans/local-928c70a6.plan.md` contains the complete PRD with detailed requirements.

## Technology Stack

- **Framework:** Next.js 15 (App Router) with Turbopack
- **Language:** TypeScript (strict mode)
- **Database:** Supabase (PostgreSQL with Row-Level Security + pgvector)
- **Package Manager:** pnpm (monorepo with workspaces)
- **Testing:** Vitest (unit), Playwright (E2E)
- **Styling:** Tailwind CSS 4
- **AI Models:** GPT-4o-mini (default), GPT-4o (fallback), runware.ai (images), text-embedding-3-large (RAG)
- **APIs:** Google Business Profile API, Google Performance API, Google Q&A API, OpenAI

## Project Structure

```
localspotlight/
├── apps/
│   └── web/              # Next.js application
│       ├── src/
│       │   ├── app/      # App Router pages and API routes
│       │   │   ├── (auth)/        # Auth pages (sign-in)
│       │   │   ├── (dashboard)/   # Dashboard pages
│       │   │   ├── api/           # API routes (Google OAuth, etc.)
│       │   │   └── auth/callback/ # OAuth callback
│       │   ├── lib/      # Supabase clients, Google OAuth, GBP integration
│       │   ├── components/
│       │   ├── types/    # database.ts (auto-generated from Supabase)
│       │   └── test/
│       └── package.json
├── packages/
│   ├── core/             # Shared business logic and AI prompts
│   │   └── src/
│   │       └── prompts/  # AI generation prompts
│   └── ui/               # Shared UI components
├── supabase/
│   ├── migrations/       # Database migrations (versioned SQL files)
│   ├── tests/            # RLS and integration tests
│   └── config.toml       # Supabase local configuration
└── context/              # Business requirements documentation
```

## Common Commands

### Development Workflow

```bash
# Install dependencies
pnpm install

# Start local Supabase (Docker required)
pnpm db:start

# Start Next.js dev server
pnpm dev

# Build production bundle
pnpm build

# Run linter (zero warnings policy)
pnpm lint

# Format code
pnpm format
```

### Database Management

```bash
# Start Supabase locally (saves connection details)
pnpm db:start

# Stop Supabase
pnpm db:stop

# Check status and connection details
pnpm db:status

# Open Supabase Studio (database UI at http://127.0.0.1:54323)
# Automatically available when db is running

# Reset database (rerun all migrations)
pnpm db:reset

# Generate TypeScript types from schema
pnpm db:types

# Create new migration
pnpm db:migrate new_migration_name

# Push migrations to cloud
pnpm db:push
```

### Testing

```bash
# Run unit tests
pnpm test

# Run unit tests with coverage
pnpm --filter web test:ci

# Run E2E tests
pnpm test:e2e

# Run single test file
cd apps/web && pnpm vitest src/test/example.test.ts
```

## Architecture Fundamentals

### Multi-Tenant Security (CRITICAL)

**Every table MUST have `org_id`** with Row-Level Security (RLS) policies enforcing absolute data isolation.

**Security Principles:**
1. Never rely on application-layer filtering alone
2. All tables have RLS enabled with org-based isolation
3. JWT tokens include `org_id` in custom claims
4. Helper functions: `auth.user_org_ids()`, `auth.user_org_role(org_id)`
5. Service role key is server-side only, never exposed to client

**When adding new tables:**
```sql
-- Always include org_id
create table new_table (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  -- other columns
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table new_table enable row level security;

-- Create policies
create policy "Users can view their org's data"
  on new_table for select
  using (org_id in (select auth.user_org_ids()));

create policy "Editors can modify data"
  on new_table for update
  using (
    org_id in (select auth.user_org_ids())
    and auth.user_org_role(org_id) in ('owner', 'admin', 'editor')
  );
```

### Supabase Client Usage

**Two clients exist:**

1. **Client-side** (`@/lib/supabase-client.ts`): Uses anon key, respects RLS
2. **Server-side** (`@/lib/supabase-server.ts`): Server Components/Actions, respects RLS

**Never bypass RLS** unless absolutely necessary and documented in audit logs.

### Database Schema Overview

**Core entities (see migrations for complete schema):**

- `orgs` - Customer organizations
- `org_members` - User membership with roles (owner, admin, editor, viewer)
- `users` - User profiles (linked to auth.users)
- `connections_google` - OAuth connections with encrypted refresh tokens
- `gbp_accounts` - Google Business Profile accounts
- `gbp_locations` - Business locations with metadata (jsonb)
- `gbp_reviews` - Customer reviews with replies
- `gbp_qna` - Q&A pairs with state tracking
- `gbp_media` - Photos/videos from GBP
- `ai_briefs` - Content briefs with vector embeddings (pgvector for RAG)
- `ai_generations` - AI outputs with risk scores, costs, model tracking
- `post_candidates` - Posts awaiting approval with images and schema
- `schedules` - Publishing calendar with retry logic
- `automation_policies` - Per-location automation settings (mode, caps, thresholds)
- `safety_rules` - Content moderation rules (banned terms, required phrases)
- `audit_logs` - Complete audit trail

**All tables enforce org-level isolation via RLS.**

### Migrations Best Practices

1. **Never edit existing migrations** - Always create new ones
2. **Test locally first** with `pnpm db:reset`
3. **Regenerate types** after schema changes: `pnpm db:types`
4. **Include RLS policies** for new tables in same or follow-up migration
5. **Use descriptive names**: `pnpm db:migrate add_location_settings_table`
6. **Migrations run in lexical order** by filename (timestamp prefix is critical)

### TypeScript Type Generation

Database types are auto-generated in `apps/web/src/types/database.ts`:

```typescript
import { Database } from "@/types/database";

type Location = Database["public"]["Tables"]["gbp_locations"]["Row"];
type LocationInsert = Database["public"]["Tables"]["gbp_locations"]["Insert"];
type LocationUpdate = Database["public"]["Tables"]["gbp_locations"]["Update"];
```

**Always regenerate after schema changes:** `pnpm db:types`

## Automation Modes (Core Feature)

LocalSpotlight supports three automation modes per location and content type (posts, Q&A, review replies):

### Mode: Off
- Feature disabled
- Only manual content creation available

### Mode: Auto-create
- AI generates content automatically based on cadence rules
- Content placed in approval queue
- Human approval required before publishing
- SLA reminders for pending approvals

### Mode: Full Autopilot
- AI generates and publishes automatically
- Guardrails enforced:
  - `risk_score <= risk_threshold` (0-1 scale)
  - Within `max_per_week` cap
  - Respects `quiet_hours` policy
  - Required fields present
  - Passes moderation checks
- Notifications sent after autopublish
- Optional undo window (`delete_window_sec`)
- Failures escalate to auto_create mode

**Configuration:** Set in `automation_policies` table per org_id, location_id, and content_type.

**Review Reply Autopilot Logic:**
- 4-5 star reviews: autopublish if low risk
- 1-3 star reviews: route to approval queue (human oversight required)
- Flagged content (PII, complaints): always route to approval

**Q&A Autopilot Logic:**
- Auto-answer incoming public questions within guardrails
- Seed new evergreen Q&A per cadence (e.g., 3/month)
- Only safe topics; complex questions route to approval

## AI Content Generation Architecture

### Model Selection Strategy

- **Default:** GPT-4o-mini (fast, cost-effective, 80% cheaper)
- **Escalate to GPT-4o when:**
  - JSON parsing fails after 2 attempts
  - Low confidence scores detected
  - Complex briefs (>2000 tokens)
  - User explicitly requests higher quality

### JSON Output Schemas

**All AI generations follow strict JSON schemas:**

#### GBP Post Schema
```json
{
  "type": "WHATS_NEW" | "EVENT" | "OFFER",
  "headline": "string (max 58 chars)",
  "body": "string (max 1500 chars)",
  "cta": "LEARN_MORE" | "CALL" | "SIGN_UP" | "BOOK" | "ORDER" | "SHOP",
  "link": "uri",
  "hashtags": ["string"] (max 6),
  "imageBrief": "string (max 400 chars)",
  "riskScore": 0-1
}
```

#### Q&A Schema
```json
{
  "question": "string (max 150 chars)",
  "answer": "string (max 1500 chars)",
  "tags": ["string"] (max 5),
  "riskScore": 0-1
}
```

#### Review Reply Schema
```json
{
  "reply": "string (max 4096 chars)",
  "rationale": "string (max 300 chars)",
  "riskScore": 0-1
}
```

### Content Grounding (RAG)

AI content is grounded in first-party data only (no external web search in v1):

1. Location metadata from `gbp_locations.meta` (services, hours, categories, description)
2. Recent posts and performance data
3. Brand voice settings from `safety_rules`
4. Vector similarity search on `ai_briefs.embeddings` using pgvector
5. Past successful content patterns

**Embedding Model:** text-embedding-3-large

### Moderation Pipeline

**All AI outputs must pass through this pipeline before approval/publish:**

1. **OpenAI Moderation API** (`omni-moderation-latest`)
   - Blocks: hate speech, violence, sexual content, self-harm
   - Log all moderation failures

2. **GBP Policy Checks**
   - No misleading claims or invented facts
   - Proper post type formatting (EVENT requires dates, OFFER requires terms)
   - No PII in public content
   - Images meet size/format requirements
   - No promotional language in Q&A answers

3. **Safety Rules** (from `safety_rules` table)
   - Banned terms check
   - Required phrases/disclaimers enforcement
   - Blocked categories check

4. **Risk Scoring**
   - AI generates `risk_score` (0-1) as part of output
   - Scores stored in `ai_generations.risk_score`
   - Autopilot gates on `risk_score <= automation_policies.risk_threshold`

### Caching Strategy

- Hash: `hash(prompt + grounding_data)` to dedupe similar requests
- TTL: 7-30 days depending on content type
- Reduces API costs and improves response times

## Google Business Profile Integration

### OAuth Flow

1. User initiates OAuth via `/app/api/google/auth`
2. Callback at `/app/auth/callback` exchanges code for tokens
3. **Refresh token is encrypted** before storing in `connections_google.refresh_token_enc`
4. Access tokens refreshed automatically before expiry (background job)
5. Scope required: `https://www.googleapis.com/auth/business.manage`

**Implementation:** See `apps/web/src/lib/google-oauth.ts`

### APIs Used

- **Business Profile API:** `https://businessprofile.googleapis.com/v1/`
  - List accounts/locations
  - Read/update location details
  - Manage media (upload photos)

- **Performance API:** `https://businessprofileperformance.googleapis.com/v1/`
  - Fetch performance metrics (views, clicks, calls, directions)
  - Daily rollups for analytics

- **Q&A API:** `https://mybusinessqanda.googleapis.com/v1/`
  - List questions/answers
  - Post answers (supported)
  - Create questions (supported)

- **Posts API:** Limited availability
  - Review reply posting (supported)
  - Posts publishing (if account has access)

### API Rate Limiting & Retry Logic

**Critical patterns to follow:**

1. **Stagger requests** - Don't publish to 100+ locations simultaneously
   - Batch with 30-60 second delays
   - Distribute scheduled posts across the hour

2. **Exponential backoff** - 1s → 2s → 4s → 8s, max 5 retries

3. **Circuit breaker**
   - After 5 consecutive failures → pause org automation for 15 minutes
   - Send notification to org admin
   - Log incident for investigation

4. **Quota monitoring**
   - Track daily API usage per org
   - Warn at 70% of quota
   - Throttle at 90% of quota
   - Reset counters at midnight UTC

### Posting Adapter Pattern

**Supports two modes for resilience:**

#### Mode A: Direct API Publishing
- Publish posts via GBP Posts API (if available)
- Upload images via Media API
- Support delete/edit when available
- Optional undo window via delayed publish

#### Mode B: Manual Assist Fallback
- Store approved/auto content in database
- Email/Slack reminders with formatted content
- One-click "Copy to clipboard" for manual posting
- Track as "published (manual)" in `schedules` table
- Optional Zapier export integration

**Always implement fallback to Mode B** for accounts without Posts API access.

## Background Jobs Architecture

### Critical Jobs (to be implemented)

1. **Google Sync** (every 6-24 hours)
   - Fetch accounts/locations via Business Profile API
   - Sync reviews, Q&As, media
   - Update location metadata in `gbp_locations.meta`
   - Refresh performance metrics from Performance API

2. **Content Scheduler** (every 5 minutes)
   - Query: `SELECT * FROM schedules WHERE publish_at <= NOW() AND status = 'pending'`
   - Attempt publishing via adapter (Mode A or B)
   - Update status to 'published' or 'failed'
   - Retry with exponential backoff on failure

3. **Token Refresh** (daily)
   - Refresh Google OAuth tokens before expiry
   - Re-encrypt and store in `connections_google`
   - Handle revocation gracefully (notify admin)

4. **Performance Ingest** (nightly)
   - Pull GBP performance data (calls, clicks, directions)
   - Calculate daily rollups
   - Store for analytics dashboard

5. **Autopilot Planners** (daily/weekly per cadence)
   - Create briefs per location based on:
     - Last post age (content gaps)
     - Seasonal templates
     - Service rotation
     - Cadence rules from `automation_policies`
   - Trigger AI generation for auto_create/autopilot modes

**Implementation approach:** Vercel Cron, Supabase Edge Functions with pg_cron, or external job runner.

**Job Monitoring:**
- Track execution time, success rate, error patterns
- Dead-letter queue for failed jobs (manual review)
- Alert on 3+ consecutive failures
- Dashboard showing job health status

## Development Patterns

### Environment Variables

```env
# apps/web/.env.local (local development)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from pnpm db:start output>
SUPABASE_SERVICE_ROLE_KEY=<from pnpm db:start output>

# OpenAI (when implemented)
OPENAI_API_KEY=sk-...

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Runware.ai (for image generation)
RUNWARE_API_KEY=...
```

**Setup:** Copy `env.example.txt` to `apps/web/.env.local` after running `pnpm db:start`.

### Monorepo Package References

**Use workspace protocol:**

```json
{
  "dependencies": {
    "@localspotlight/core": "workspace:*",
    "@localspotlight/ui": "workspace:*"
  }
}
```

**Import shared code:**

```typescript
import { Something } from "@localspotlight/core";
import { Button } from "@localspotlight/ui";
import { systemPrompt } from "@localspotlight/core/prompts";
```

### Path Aliases

```typescript
// In apps/web/
import { supabase } from "@/lib/supabase-client";
import { AuthProvider } from "@/components/providers/auth-provider";
import { Database } from "@/types/database";
```

**Configured in:** `apps/web/tsconfig.json` (`@/*` → `./src/*`)

## Testing Strategy

### Unit Tests (Vitest)

- Test business logic in `packages/core`
- Test utility functions in `apps/web/src/lib`
- Mock Supabase client for isolated tests
- Test AI prompt generation and output parsing
- Test risk scoring logic

### E2E Tests (Playwright)

**Critical scenarios to test:**
1. **Cross-org data isolation** - User A cannot access Org B data
2. **Role-based permissions** - Viewer cannot edit, editor can modify
3. **OAuth flow** - Complete Google OAuth and token storage
4. **Content approval workflow** - Generate → approve → schedule → publish
5. **Autopilot guardrails** - Risk threshold enforcement, caps, quiet hours
6. **Publishing with retry** - Failure handling and exponential backoff

### RLS Testing

**Manual SQL tests** in `supabase/tests/`:

```sql
-- Test cross-org isolation
set local role authenticated;
set local request.jwt.claims.sub to 'user-a-id';

-- Should return only Org 1 data
select * from gbp_locations;

-- Attempt to access Org 2 data (should return empty)
select * from gbp_locations where org_id = 'org-2-id';
```

**Run via:** `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres < supabase/tests/rls_test.sql`

## Code Quality Standards

### TypeScript

- **Strict mode enabled** - No implicit any, strict null checks
- **Prefer type inference** where possible
- **Use Database types** from auto-generated schema
- **Avoid `any`** - Use `unknown` and type guards instead
- **Exhaustive switch statements** for enums

### Next.js App Router Patterns

- **Server Components by default** - Add `'use client'` only when needed (interactivity, hooks)
- **Server Actions for mutations** - Avoid client-side API routes where possible
- **Streaming and Suspense** - Use for better perceived performance
- **Metadata API** - For SEO and social sharing
- **Route Groups** - Organize by layout (`(auth)`, `(dashboard)`)

### Linting & Formatting

- **ESLint:** Zero warnings policy (`--max-warnings=0`)
- **Prettier:** Auto-format on save (config in `.prettierrc`)
- Run `pnpm lint` before committing
- Run `pnpm format` to fix formatting issues

## Security Checklist

Before deploying any feature:

- [ ] RLS policies created and tested for new tables
- [ ] No hardcoded secrets or API keys in code
- [ ] Service role key never exposed to client
- [ ] Google refresh tokens encrypted at rest
- [ ] Audit logging implemented for sensitive actions
- [ ] Cross-org access tested and blocked
- [ ] Role-based permissions enforced
- [ ] Input validation on all user inputs
- [ ] Rate limiting on public endpoints
- [ ] Moderation pipeline enforced for AI outputs
- [ ] PII handling compliant (no invented contact info)

## Common Gotchas

1. **Database types out of sync** - Always run `pnpm db:types` after schema changes
2. **RLS blocking legitimate queries** - Verify user is authenticated and org membership exists
3. **Docker not running** - Supabase requires Docker Desktop running first
4. **Port conflicts** - Ports 54321-54324 must be available (kill with `lsof -ti:54321 | xargs kill -9`)
5. **Migration order matters** - Migrations run in lexical order by timestamp prefix
6. **Workspace protocol** - Use `workspace:*` not file paths in package.json
7. **Environment variables** - Next.js requires `NEXT_PUBLIC_` prefix for client-side vars
8. **Turbopack caching** - Clear `.next` directory if seeing stale builds
9. **Autopilot risk threshold** - Default conservatively (e.g., 0.3) until confidence is validated
10. **Google API quotas** - Implement staggering and circuit breakers from day one

## Business Context & Metrics

**Primary Goal:** 25% QoQ uplift in conversion metrics (ACTIONS_PHONE, ACTIONS_WEBSITE)

**Focus on transactional activity over vanity metrics:**
- ✅ Phone calls from GBP
- ✅ Website clicks from GBP
- ✅ Direction requests
- ❌ Not profile views or impressions alone

**Key operational metrics:**
- Content generation → approval rate (target: 80%+)
- Time-to-approval (target: <24 hours)
- Scheduled → published success rate (target: >95%)
- Per-location content cadence (target: 3-5 posts/week)
- Autopilot: publish count, failure rate, escalations, avg risk score

**Platform provides value through:**
1. Automated content generation (posts, Q&A, review replies)
2. Multi-location management at scale (100+ locations per org)
3. Brand-aligned AI outputs (respects brand voice settings)
4. Compliance safeguards (GBP policies, moderation)
5. Performance analytics (proving ROI through conversion metrics)

## Roadmap Features (Paige Parity)

**Future modules (v1.1+):**

- **Social cross-posting:** Publish to Facebook Pages & Instagram Business via Meta Graph API
- **Image optimization:** Rename for keywords, generate alt text, add EXIF geotags, compress
- **Video creation:** Slideshow videos from images with captions/music, publish to GBP/YouTube/FB/IG
- **Review campaigns:** Email/SMS flows to request reviews with compliant deep links
- **Website widgets:** Embeddable script for recent GBP posts/reviews/photos
- **Heatmap rankings:** Integrate rank tracking provider for local heatmaps
- **Citations management:** Sync to 40+ directories via listings provider

**Additional tables needed:**
- `connections_meta`, `social_posts`, `image_jobs`, `video_jobs`, `review_campaigns`, `widgets`, `heatmap_reports`, `citations_jobs`

## Key Documentation Files

- **`.cursor/plans/local-928c70a6.plan.md`** - Complete PRD (source of truth)
- **`QUICK_START.md`** - Get running in 5 minutes
- **`SUPABASE_SETUP.md`** - Complete database setup guide
- **`DATABASE_README.md`** - Database architecture and patterns
- **`CLOUD_MIGRATION.md`** - Deploying to production
- **`context/Business Context & Implementation Notes.md`** - Business requirements, user flows, success metrics
- **`env.example.txt`** - Environment variable template

## Milestones

**M1 (2-3 weeks):** Auth/Org/RLS, Google connect/sync, AI briefs + basic generations, approvals, review reply drafts, brand & automation settings (off/auto_create modes)

**M2 (2-3 weeks):** Scheduler + calendar, images + media upload, Q&A publish, analytics v1, performance ingest, posting adapter, Full Autopilot mode with guardrails

**M3 (2-4 weeks):** Social cross-posting, image optimization, video creation, review campaigns v1, widgets v1, provider hooks for heatmaps/citations (behind feature flags)
