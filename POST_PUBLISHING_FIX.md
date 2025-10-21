# Post Publishing System - Issue Resolution

## Problem Summary

Scheduled posts were stuck in the queue and never getting published. The system showed posts in "pending" status that were past their scheduled publish time.

## Root Causes Identified

### 1. **Invalid Supabase Configuration**
- The `supabase/config.toml` file contained `[[cron.jobs]]` configuration (lines 318-330)
- This configuration format is not supported by Supabase CLI v2.39.2
- The invalid config prevented Supabase from starting properly and blocked all automation

### 2. **Missing Database Schema Columns**
- The `schedules` table was missing retry-related columns that the edge function expected:
  - `retry_count` - Track number of publish attempts
  - `next_retry_at` - Schedule retry with exponential backoff
  - `last_error` - Store error messages for debugging
  - `meta` - Store additional metadata (error history, attempt timestamps)
- A migration file existed (`20251021090001_add_schedules_indexes.sql`) but had issues

### 3. **Migration Syntax Error**
- The migration used `CREATE INDEX CONCURRENTLY` which is not allowed in Supabase migrations
- `CONCURRENTLY` can only be used in live database operations, not in migration scripts

### 4. **Missing Environment Variables**
- Edge function required environment variables that weren't configured:
  - `GOOGLE_REFRESH_TOKEN_SECRET` - For encrypting refresh tokens
  - `PUBLISH_POSTS_CRON_SECRET` - For authenticating cron requests
  - `AUTOMATION_CRON_SECRET` - For automation workflows

### 5. **No Automated Publishing Process**
- Without functioning cron jobs, there was no automated process to:
  - Query pending schedules every 5 minutes
  - Call the edge function to publish posts
  - Handle retries for failed publishes

### 6. **Google Posts API Deprecation**
- The edge function uses the deprecated My Business API v4 endpoint:
  - `https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/localPosts`
- According to Google, the Posts publishing API was deprecated in 2021
- This means automated posting may not work even if the cron system is fixed

## Fixes Applied

### 1. Fixed Supabase Configuration
**File:** `supabase/config.toml`
- Commented out the `[[cron.jobs]]` configuration
- Added note that cron requires Supabase CLI v2.40+
- Recommended using manual trigger scripts instead

### 2. Fixed Database Migration
**File:** `supabase/migrations/20251021090001_add_schedules_indexes.sql`
- Removed `CONCURRENTLY` keyword from all `CREATE INDEX` statements
- Added `meta JSONB DEFAULT '{}'::jsonb` column
- Migration now runs successfully

**Schema changes:**
```sql
ALTER TABLE schedules
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_error TEXT,
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::jsonb;
```

### 3. Added Environment Variables
**Files:**
- `apps/web/.env.local` - Added to Next.js app
- `supabase/.env` - Created for edge functions

**Variables added:**
```bash
GOOGLE_REFRESH_TOKEN_SECRET=localspotlight_dev_secret_key_minimum_32_chars_required
PUBLISH_POSTS_CRON_SECRET=dev_publish_posts_secret_key
AUTOMATION_CRON_SECRET=dev_automation_secret_key
```

### 4. Created Diagnostic Tools

**`scripts/check-pending-posts.sh`**
- Shows all pending posts in the queue
- Identifies overdue vs. scheduled posts
- Displays failed posts needing retry
- Provides summary statistics

**Usage:**
```bash
cd /Users/jason/Cursor/projects/kreativ\ solutions/localspotlight
./scripts/check-pending-posts.sh
```

**`scripts/trigger-publish-posts.sh`**
- Manually triggers the edge function to publish pending posts
- Uses service role key for authentication
- Returns detailed results (processed, published, failed counts)

**Usage:**
```bash
./scripts/trigger-publish-posts.sh
```

### 5. Database Reset Applied
- Ran `supabase db reset` to apply all migrations cleanly
- All tables now have correct schema
- Seed data reloaded successfully

## Current System Status

### ✅ Fixed
- Supabase config is valid and parseable
- Database schema is complete with all retry columns
- Environment variables are configured
- Diagnostic scripts are available

### ⚠️ Remaining Issues

1. **Google Posts API is Deprecated**
   - The edge function at `supabase/functions/publish-posts/index.ts` uses deprecated APIs
   - Automated posting may not work even with fixed infrastructure
   - **Recommended:** Implement "Mode B: Manual Assist Fallback" from CLAUDE.md:
     - Store approved content in database
     - Email/Slack reminders with formatted content
     - One-click "Copy to clipboard" for manual posting
     - Track as "published (manual)" in schedules table

2. **No Cron Automation (Local Development)**
   - Supabase CLI v2.39.2 doesn't support `[[cron.jobs]]` config
   - **Options:**
     - Update to Supabase CLI v2.40+ (latest is v2.53.6)
     - Use external cron service (like cron-job.org) to call edge function
     - Use Vercel Cron when deployed to production
     - Manually trigger via script until cron is working

3. **Edge Function Needs Testing**
   - The `publish-posts` edge function hasn't been successfully tested yet
   - May have runtime errors related to the deprecated Google API
   - Needs thorough testing and likely refactoring

## Next Steps

### Immediate (to unstuck posts):

1. **If you have "stuck" posts now:**
   ```bash
   # Check what's pending
   ./scripts/check-pending-posts.sh

   # Try publishing (may fail due to Google API deprecation)
   ./scripts/trigger-publish-posts.sh
   ```

2. **For posts that can't auto-publish:**
   - Mark them as requiring manual publishing
   - Export post content for copy/paste into Google Business Profile Manager
   - Track as "published_manual" status

### Short-term (next 1-2 weeks):

1. **Update Supabase CLI:**
   ```bash
   brew upgrade supabase
   # or npm update -g supabase
   ```

2. **Implement Manual Assist Mode:**
   - Create UI to display pending posts with "Copy Content" button
   - Add email/Slack notifications for pending posts
   - Add "Mark as Manually Published" action
   - Update documentation for manual workflow

3. **Test Edge Function Thoroughly:**
   - Add comprehensive logging
   - Test with real Google account
   - Handle API errors gracefully
   - Implement fallback to manual mode on failure

### Long-term (next month):

1. **Research Google API Alternatives:**
   - Check if Google Business Profile Performance API supports posts
   - Investigate if there's a new posts endpoint
   - Consider using Google Business Profile Manager API (if available)

2. **Implement Robust Automation:**
   - Set up Vercel Cron for production
   - Implement circuit breakers for API failures
   - Add comprehensive error tracking (Sentry)
   - Build admin dashboard for monitoring publish success rate

3. **Build Autopilot Features:**
   - Implement guardrails (risk score, quiet hours, caps)
   - Add auto-create mode (AI generates, human approves)
   - Build full autopilot mode with safety checks
   - Create escalation workflow for high-risk content

## Testing Checklist

- [x] Supabase config is valid (`supabase status` works)
- [x] Database has all retry columns (`\d schedules` shows retry_count, next_retry_at, last_error, meta)
- [x] Environment variables are set
- [x] Check pending posts script works
- [ ] Edge function runs without errors
- [ ] Edge function successfully calls Google API
- [ ] Posts get published to Google Business Profile
- [ ] Failed posts retry with exponential backoff
- [ ] Cron jobs run automatically (after CLI update)

## Files Modified

1. `supabase/config.toml` - Commented out invalid cron config
2. `supabase/migrations/20251021090001_add_schedules_indexes.sql` - Fixed CONCURRENTLY issue, added meta column
3. `apps/web/.env.local` - Added missing environment variables
4. `supabase/.env` - Created with edge function environment variables
5. `scripts/check-pending-posts.sh` - Created diagnostic script
6. `scripts/trigger-publish-posts.sh` - Created manual trigger script

## Files Created

1. `supabase/.env` - Edge function environment variables
2. `scripts/check-pending-posts.sh` - Diagnostic tool
3. `scripts/trigger-publish-posts.sh` - Manual publish trigger
4. `POST_PUBLISHING_FIX.md` - This document

## Related Documentation

- `CLAUDE.md` - Project overview and architecture (see "Posting Adapter Pattern")
- `POST_PUBLISHING_SYSTEM.md` - Detailed post publishing architecture
- `supabase/functions/publish-posts/README.md` - Edge function documentation
- `GOOGLE_API_STATUS_2025.md` - Google API deprecation status

## Support & Troubleshooting

**If posts are still stuck:**
1. Check Supabase is running: `supabase status`
2. Check for pending posts: `./scripts/check-pending-posts.sh`
3. Check edge function logs: `supabase functions logs publish-posts`
4. Try manual trigger: `./scripts/trigger-publish-posts.sh`

**If edge function fails:**
1. Check environment variables are set in `supabase/.env`
2. Verify Google OAuth tokens are valid in `connections_google` table
3. Check edge function logs for specific errors
4. Consider implementing manual assist mode as fallback

**For further assistance:**
- Review edge function code: `supabase/functions/publish-posts/index.ts`
- Check Google API status: GOOGLE_API_STATUS_2025.md
- Consult LocalSpotlight architecture: CLAUDE.md
