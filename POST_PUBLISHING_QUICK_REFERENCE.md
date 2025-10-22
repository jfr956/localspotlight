# Post Publishing System - Quick Reference

## Quick Start

### Start Supabase & Functions
```bash
# Terminal 1: Start Supabase
pnpm db:start

# Terminal 2: Serve edge functions
cd /path/to/localspotlight
pnpm supabase functions serve --no-verify-jwt
```

### Run End-to-End Test
```bash
cd apps/web
npx tsx test-publish-pipeline.ts
```

---

## Common Operations

### 1. Manually Trigger Publishing
Processes all pending schedules:
```bash
curl -X POST http://127.0.0.1:54321/functions/v1/publish-posts \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU" \
  -H "Content-Type: application/json"
```

### 2. Create a Test Schedule
```sql
-- Connect to database
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres

-- Create schedule for immediate publishing
INSERT INTO schedules (org_id, location_id, target_type, target_id, publish_at, status)
VALUES (
  'efd2615e-998b-4b70-83e0-0800c7cffc5a',  -- org_id
  '34dee80b-b958-44c3-bd80-b998ae587fa2',  -- location_id (Texas Lone Star)
  'post_candidate',
  'b9f590bf-4c1a-4c3c-9593-7a25d2d368d1',  -- post_candidate_id
  NOW(),                                    -- publish immediately
  'pending'
);
```

### 3. Check Recent Publish Status
```sql
SELECT
  id,
  status,
  publish_at,
  provider_ref,
  created_at
FROM schedules
ORDER BY created_at DESC
LIMIT 5;
```

### 4. View Published Posts
```sql
SELECT
  google_post_name,
  topic_type,
  state,
  LEFT(summary, 80) as summary_preview,
  created_at
FROM gbp_posts
ORDER BY created_at DESC
LIMIT 5;
```

### 5. Check Audit Logs
```sql
SELECT
  action,
  created_at,
  meta->>'error' as error,
  meta->>'googlePostName' as post_name
FROM audit_logs
WHERE action LIKE 'post_%'
ORDER BY created_at DESC
LIMIT 10;
```

### 6. Retry Failed Schedules
```sql
-- Reset failed schedules to retry
UPDATE schedules
SET
  status = 'pending',
  retry_count = 0,
  last_error = NULL,
  next_retry_at = NULL
WHERE status = 'failed'
AND retry_count < 3;
```

---

## Troubleshooting

### Issue: "Decryption failed"
**Cause:** Encryption secret mismatch

**Fix:**
```bash
# Check all three files have the same secret:
grep GOOGLE_REFRESH_TOKEN_SECRET apps/web/.env.local
grep GOOGLE_REFRESH_TOKEN_SECRET supabase/functions/.env
grep GOOGLE_REFRESH_TOKEN_SECRET supabase/.env

# All should return: 0123456789abcdef0123456789abcdef
```

### Issue: "API endpoint not found (404)"
**Cause:** Double "accounts/" in URL

**Fix:**
Already fixed in `/supabase/functions/publish-posts/index.ts` line 312:
```typescript
const accountId = connection.account_id.replace('accounts/', '')
```

If still seeing this error, restart functions:
```bash
# Kill existing functions
pkill -f "supabase functions serve"

# Restart
pnpm supabase functions serve --no-verify-jwt
```

### Issue: "Google OAuth token expired"
**Symptom:** 401/403 from Google API

**Fix:**
```sql
-- Check connection status
SELECT account_id, created_at
FROM connections_google
WHERE org_id = 'YOUR_ORG_ID';

-- If token is old, re-authenticate via the app:
-- 1. Go to http://127.0.0.1:3000/integrations/google
-- 2. Click "Reconnect Google"
-- 3. Complete OAuth flow
```

### Issue: Edge function not starting
**Cause:** Port conflict or Supabase not running

**Fix:**
```bash
# Check if Supabase is running
pnpm db:status

# If not running:
pnpm db:start

# Check port 54321 is available
lsof -ti:54321

# If occupied, kill process:
kill -9 $(lsof -ti:54321)

# Restart functions
pnpm supabase functions serve --no-verify-jwt
```

### Issue: No schedules being processed
**Cause:** publish_at time is in the future

**Check:**
```sql
SELECT
  id,
  publish_at,
  NOW() as current_time,
  (publish_at <= NOW()) as is_due,
  status
FROM schedules
WHERE status = 'pending'
ORDER BY publish_at;
```

**Fix:**
```sql
-- Reschedule to now
UPDATE schedules
SET publish_at = NOW()
WHERE status = 'pending'
AND publish_at > NOW();
```

---

## Monitoring

### Real-time Function Logs
When functions are running with `pnpm supabase functions serve`, you'll see:
```
[PublishPosts] Starting post publishing worker
[PublishPosts] Processing 1 schedules (0 retries, 1 new)
[PublishPosts] Publishing to account 102864608154197885581, location 16919135625305195332
[PublishPosts] Successfully created post: accounts/.../localPosts/1380208120352460179
[PublishPosts] ✓ Published schedule 7b3b565f-03aa-49d1-bfbd-9fdcdede9aeb
```

### Database Monitoring Queries

#### Publishing Success Rate
```sql
SELECT
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM schedules
WHERE target_type = 'post_candidate'
GROUP BY status;
```

#### Recent Publishing Activity
```sql
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as published_count
FROM schedules
WHERE status = 'published'
AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

#### Failed Publish Reasons
```sql
SELECT
  meta->>'error' as error_message,
  COUNT(*) as occurrences
FROM schedules
WHERE status = 'failed'
GROUP BY meta->>'error'
ORDER BY occurrences DESC;
```

---

## Testing Checklist

Before deploying to production:

- [ ] Environment variables match across all three files
- [ ] Supabase is running (`pnpm db:status`)
- [ ] Edge functions are running (`pnpm supabase functions serve`)
- [ ] Test script passes (`npx tsx test-publish-pipeline.ts`)
- [ ] Published post appears in database (`SELECT * FROM gbp_posts`)
- [ ] Published post visible in Google Business Profile
- [ ] Audit logs created (`SELECT * FROM audit_logs WHERE action = 'post_published'`)
- [ ] Failed schedules trigger retry logic
- [ ] OAuth tokens are recent (< 7 days old)

---

## Production Deployment

### 1. Update Environment Variables in Supabase Dashboard
```
Project Settings → Edge Functions → Secrets:

GOOGLE_CLIENT_ID=YOUR_PRODUCTION_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_PRODUCTION_CLIENT_SECRET
GOOGLE_REFRESH_TOKEN_SECRET=YOUR_PRODUCTION_SECRET (must match Next.js app)
```

### 2. Deploy Edge Function
```bash
pnpm supabase functions deploy publish-posts
```

### 3. Set Up Cron Job
In Supabase dashboard or via cron config:
```toml
[[cron.jobs]]
name = "publish_posts"
schedule = "*/5 * * * *"  # Every 5 minutes
request.method = "POST"
request.url = "https://YOUR_PROJECT.supabase.co/functions/v1/publish-posts"
request.headers.Authorization = "Bearer YOUR_PROD_SERVICE_ROLE_KEY"
```

### 4. Monitor Initial Runs
```sql
-- Watch for any failures
SELECT * FROM schedules
WHERE created_at > NOW() - INTERVAL '1 hour'
AND status IN ('failed', 'published')
ORDER BY created_at DESC;
```

---

## Support

### Key Files
- **Edge Function:** `/supabase/functions/publish-posts/index.ts`
- **Encryption:** `/supabase/functions/publish-posts/encryption.ts`
- **Test Script:** `/apps/web/test-publish-pipeline.ts`
- **Environment:** `/supabase/functions/.env`

### Database Tables
- `schedules` - Publishing queue
- `post_candidates` - Content to publish
- `gbp_posts` - Published post records
- `gbp_locations` - Location metadata
- `connections_google` - OAuth tokens
- `audit_logs` - Publishing history

### Common Error Codes
- `401/403` - OAuth token invalid/expired
- `404` - Posts API not enabled OR malformed URL
- `400` - Invalid post data (check required fields)
- `500` - Server error (check function logs)

---

## Performance Tips

1. **Batch Processing:** Edge function processes up to 40 schedules per run
2. **Rate Limiting:** Built-in 30-60 second delays between posts
3. **Retry Logic:** Failed posts automatically retry with exponential backoff (3 attempts)
4. **Quiet Hours:** Respects automation_policies.quiet_hours to avoid posting at inappropriate times
5. **Circuit Breaker:** After 5 consecutive failures, pauses automation for 15 minutes

---

## Next Features

### Coming Soon
- [ ] Image upload support (Media API integration)
- [ ] Manual assist mode (fallback for accounts without Posts API)
- [ ] Post scheduling UI (calendar view)
- [ ] Performance analytics (track post views/clicks)
- [ ] Bulk scheduling
- [ ] Post templates library

### Feature Flags
To enable when ready:
- `ENABLE_IMAGE_UPLOAD=true` - Activate media upload
- `ENABLE_MANUAL_ASSIST=true` - Fallback mode for restricted accounts
- `ENABLE_POST_ANALYTICS=true` - Track post performance metrics
