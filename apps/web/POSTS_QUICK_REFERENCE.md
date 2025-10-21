# Posts API Quick Reference

## Endpoints

### Sync Posts
```bash
POST /api/sync/posts
Content-Type: application/json

{ "orgId": "uuid" }
```

### Create Post
```bash
POST /api/posts/create
Content-Type: application/json

{
  "locationId": "uuid",
  "summary": "Post content (max 1500 chars)",
  "topicType": "STANDARD" | "EVENT" | "OFFER",
  "callToAction": {
    "actionType": "LEARN_MORE",
    "url": "https://example.com"
  }
}
```

## Test Commands

```bash
# Direct library test (recommended)
tsx test-posts-direct.ts

# Full API integration test
tsx test-posts-api.ts

# Manual curl test
curl -X POST http://localhost:3000/api/posts/create \
  -H "Content-Type: application/json" \
  -d '{"locationId":"uuid","summary":"Test post","topicType":"STANDARD"}'
```

## Post Types

**STANDARD:** General purpose posts
```json
{
  "topicType": "STANDARD",
  "summary": "Your content here"
}
```

**EVENT:** Posts with dates
```json
{
  "topicType": "EVENT",
  "event": {
    "title": "Event Name",
    "schedule": {
      "startDate": { "year": 2025, "month": 11, "day": 15 }
    }
  }
}
```

**OFFER:** Posts with promotions
```json
{
  "topicType": "OFFER",
  "offer": {
    "couponCode": "CODE123",
    "termsConditions": "Valid until..."
  }
}
```

## Call-to-Action Types

- `LEARN_MORE` - Most common
- `CALL` - Phone call
- `BOOK` - Appointments
- `ORDER` - Food/products
- `SIGN_UP` - Memberships
- `SHOP` - E-commerce

## Database Tables

**gbp_posts** - All posts (synced + created)
**schedules** - Publishing events tracking

## Security

- Authentication required
- Sync: Owner/Admin only
- Create: Owner/Admin/Editor
- RLS policies enforced

## Files

**API Routes:**
- `/src/app/api/sync/posts/route.ts`
- `/src/app/api/posts/create/route.ts`

**Test Scripts:**
- `test-posts-direct.ts` (library test)
- `test-posts-api.ts` (API test)

**Documentation:**
- `POSTS_API_SUMMARY.md` (overview)
- `POSTS_API_IMPLEMENTATION.md` (detailed)

## Common Errors

**403/404:** Posts API not available for account
**400 Invalid summary:** Check length (<1500 chars)
**403 Access denied:** Check user role
**500 Decrypt failed:** Check GOOGLE_REFRESH_TOKEN_SECRET

## Quick Debug

```bash
# Check posts in database
psql $DATABASE_URL -c "SELECT id, topic_type, summary FROM gbp_posts ORDER BY created_at DESC LIMIT 5;"

# Check connections
psql $DATABASE_URL -c "SELECT org_id, account_id FROM connections_google;"

# Check locations
psql $DATABASE_URL -c "SELECT id, title, is_managed FROM gbp_locations WHERE is_managed=true;"
```
