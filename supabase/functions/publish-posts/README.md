# Post Publisher Edge Function

This Supabase Edge Function handles publishing scheduled posts to Google Business Profile.

## Overview

The function:

1. Queries the `schedules` table for pending posts that are due to publish
2. Retrieves the associated post candidates and Google OAuth tokens
3. Publishes the posts to Google Business Profile API
4. Updates the schedule status and stores the Google post reference
5. Handles retries with exponential backoff
6. Creates audit logs for all publishing attempts

## Environment Variables

Required environment variables:

```bash
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Cron Authentication
PUBLISH_POSTS_CRON_SECRET=your_cron_secret

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REFRESH_TOKEN_SECRET=your_encryption_secret (32+ characters)
```

## Database Schema

The function expects the following tables:

### schedules

- `id`: UUID (primary key)
- `org_id`: UUID
- `location_id`: UUID
- `target_type`: string (should be "post_candidate")
- `target_id`: UUID (references post_candidates.id)
- `publish_at`: timestamptz
- `status`: string ("pending", "published", "failed", "cancelled")
- `retry_count`: integer (default 0)
- `last_error`: text
- `next_retry_at`: timestamptz

### post_candidates

- `id`: UUID (primary key)
- `org_id`: UUID
- `location_id`: UUID
- `schema`: jsonb (post content)
- `images`: text[] (base64 image data)
- `status`: string

### connections_google

- `account_id`: string
- `refresh_token_enc`: string (encrypted)
- `scopes`: text[]

### gbp_locations

- `id`: UUID
- `org_id`: UUID
- `google_location_name`: string
- `meta`: jsonb

### gbp_posts

- `google_post_name`: string
- `summary`: text
- `topic_type`: string
- `state`: string
- etc.

## Deployment

1. Deploy the function:

```bash
supabase functions deploy publish-posts
```

2. Set the required secrets:

```bash
supabase secrets set PUBLISH_POSTS_CRON_SECRET=your_secret
supabase secrets set GOOGLE_CLIENT_ID=your_client_id
supabase secrets set GOOGLE_CLIENT_SECRET=your_client_secret
supabase secrets set GOOGLE_REFRESH_TOKEN_SECRET=your_32_char_secret
```

3. The cron job is automatically configured in `supabase/config.toml` and will run every 5 minutes.

## Testing

You can test the function manually:

```bash
curl -X POST 'http://localhost:54321/functions/v1/publish-posts' \
  -H 'Authorization: Bearer your_cron_secret' \
  -H 'Content-Type: application/json'
```

## Error Handling

The function implements robust error handling:

1. **Transient errors**: Automatically retried with exponential backoff (max 3 retries)
2. **Permanent errors**: Marked as failed after max retries
3. **Rate limiting**: Respects Google API limits
4. **Audit logging**: All attempts are logged to the `audit_logs` table

## Monitoring

Check the function logs:

```bash
supabase functions logs publish-posts
```

Monitor the database for:

- Schedules with status "failed" and retry_count >= 3
- Audit logs for publishing attempts
- gbp_posts table for successful publications

## Post Schema Transformation

The function transforms post candidate schemas to Google API format:

```typescript
// Input (post_candidates.schema)
{
  type: "WHATS_NEW" | "EVENT" | "OFFER",
  description: "Post content",
  title: "Title (for EVENT/OFFER)",
  cta: {
    action: "LEARN_MORE" | "CALL" | "BOOK" | "ORDER" | "SIGN_UP" | "SHOP",
    url: "https://example.com"
  },
  // ... other fields
}

// Output (Google API)
{
  languageCode: "en",
  summary: "Post content",
  topicType: "STANDARD" | "EVENT" | "OFFER",
  callToAction: { actionType: "...", url: "..." },
  // ... other fields
}
```

## Security

- All requests must include a valid cron secret
- Database operations use service role key
- Google OAuth tokens are encrypted at rest
- Row Level Security policies are enforced
