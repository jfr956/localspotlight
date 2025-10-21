# Posts System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         GOOGLE BUSINESS PROFILE                          │
│                    https://business.google.com                           │
│                                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │   Location   │  │   Location   │  │   Location   │                   │
│  │      #1      │  │      #2      │  │      #3      │                   │
│  │   20 posts   │  │   15 posts   │  │   18 posts   │                   │
│  └──────────────┘  └──────────────┘  └──────────────┘                   │
│         ▲                  ▲                  ▲                           │
└─────────┼──────────────────┼──────────────────┼───────────────────────────┘
          │                  │                  │
          │ Google My Business API v4           │
          │ (mybusiness.googleapis.com)         │
          │                  │                  │
┌─────────┴──────────────────┴──────────────────┴───────────────────────────┐
│                    LOCALSPOTLIGHT BACKEND                                  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────┐    │
│  │                    API ROUTES (Next.js)                           │    │
│  │                                                                   │    │
│  │  ┌─────────────────────────┐  ┌─────────────────────────────┐   │    │
│  │  │  POST /api/sync/posts   │  │  POST /api/posts/create     │   │    │
│  │  │                         │  │                             │   │    │
│  │  │  • Auth check           │  │  • Auth check               │   │    │
│  │  │  • Get all connections  │  │  • Validate post data       │   │    │
│  │  │  • Decrypt tokens       │  │  • Get connection           │   │    │
│  │  │  • Fetch posts per loc  │  │  • Decrypt token            │   │    │
│  │  │  • Upsert to database   │  │  • Create post via API      │   │    │
│  │  │  • Return statistics    │  │  • Store in database        │   │    │
│  │  └─────────────────────────┘  └─────────────────────────────┘   │    │
│  │            │                              │                      │    │
│  └────────────┼──────────────────────────────┼──────────────────────┘    │
│               │                              │                            │
│               ▼                              ▼                            │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │              LIBRARY FUNCTIONS (src/lib/google-business.ts)       │   │
│  │                                                                   │   │
│  │  ┌─────────────────────────┐  ┌─────────────────────────────┐   │   │
│  │  │  fetchGooglePosts()     │  │  createGooglePost()         │   │   │
│  │  │                         │  │                             │   │   │
│  │  │  • OAuth client setup   │  │  • OAuth client setup       │   │   │
│  │  │  • Call Google API      │  │  • Validate content         │   │   │
│  │  │  • Handle pagination    │  │  • POST to Google API       │   │   │
│  │  │  • Return LocalPost[]   │  │  • Return created post      │   │   │
│  │  └─────────────────────────┘  └─────────────────────────────┘   │   │
│  │                                                                   │   │
│  │  Helper functions:                                                │   │
│  │  • extractAccountId()  • extractLocationId()                     │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │                  SUPABASE DATABASE (PostgreSQL)                   │   │
│  │                                                                   │   │
│  │  ┌─────────────────────┐  ┌──────────────────┐  ┌─────────────┐ │   │
│  │  │     gbp_posts       │  │    schedules     │  │ connections │ │   │
│  │  │                     │  │                  │  │   _google   │ │   │
│  │  │ • org_id (RLS)      │  │ • org_id         │  │             │ │   │
│  │  │ • location_id       │  │ • location_id    │  │ • org_id    │ │   │
│  │  │ • google_post_name  │  │ • target_type    │  │ • account   │ │   │
│  │  │ • summary           │  │ • target_id      │  │ • refresh   │ │   │
│  │  │ • topic_type        │  │ • publish_at     │  │   _token_   │ │   │
│  │  │ • call_to_action    │  │ • status         │  │   enc       │ │   │
│  │  │ • event details     │  │ • provider_ref   │  │             │ │   │
│  │  │ • offer details     │  │                  │  │             │ │   │
│  │  │ • media_urls        │  │                  │  │             │ │   │
│  │  │ • state             │  │                  │  │             │ │   │
│  │  │ • meta (jsonb)      │  │                  │  │             │ │   │
│  │  │ • timestamps        │  │                  │  │             │ │   │
│  │  └─────────────────────┘  └──────────────────┘  └─────────────┘ │   │
│  │                                                                   │   │
│  │  RLS Policies:                                                    │   │
│  │  • Users can view their org's posts                              │   │
│  │  • Editors can insert/update posts                               │   │
│  │  • Owners can delete posts                                       │   │
│  │  • All operations respect org_id isolation                       │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │                   ENCRYPTION (src/lib/encryption.ts)              │   │
│  │                                                                   │   │
│  │  • AES-256-GCM encryption for refresh tokens                     │   │
│  │  • GOOGLE_REFRESH_TOKEN_SECRET environment variable              │   │
│  │  • encryptRefreshToken() / decryptRefreshToken()                 │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                            TEST SCRIPTS                                  │
│                                                                           │
│  ┌──────────────────────────┐  ┌──────────────────────────────────┐    │
│  │  test-posts-direct.ts    │  │  test-posts-api.ts               │    │
│  │                          │  │                                  │    │
│  │  • Tests library funcs   │  │  • Tests HTTP endpoints          │    │
│  │  • Direct Google API     │  │  • Full integration              │    │
│  │  • Detailed logging      │  │  • Both sync & create            │    │
│  │  • DB storage            │  │  • Verification in DB            │    │
│  └──────────────────────────┘  └──────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Sync Flow (Read)
```
1. User → POST /api/sync/posts { orgId }
2. API → Verify auth & permissions
3. API → Fetch connections_google for org
4. API → Decrypt refresh tokens
5. For each location:
   a. API → fetchGooglePosts(token, accountId, locationId)
   b. Library → Google My Business API
   c. Google → Return posts data
   d. Library → Parse & return LocalPost[]
   e. API → Upsert to gbp_posts table
6. API → Return sync statistics
7. User ← { totalPostsSynced, errors, ... }
```

### Create Flow (Write)
```
1. User → POST /api/posts/create { locationId, summary, ... }
2. API → Verify auth & permissions
3. API → Validate post content
4. API → Get connection for location
5. API → Decrypt refresh token
6. API → createGooglePost(token, accountId, locationId, postData)
7. Library → Validate post structure
8. Library → POST to Google My Business API
9. Google → Create post & return details
10. Library → Return created LocalPost
11. API → Store in gbp_posts table
12. API → Create schedule entry (status: 'published')
13. API → Return success response
14. User ← { post details, searchUrl }
```

## Security Layers

```
┌─────────────────────────────────────┐
│  1. Authentication (Next.js Auth)   │  → Session cookies
├─────────────────────────────────────┤
│  2. Organization Membership Check   │  → org_members table
├─────────────────────────────────────┤
│  3. Role-Based Access Control       │  → owner/admin/editor
├─────────────────────────────────────┤
│  4. Row-Level Security (RLS)        │  → Supabase policies
├─────────────────────────────────────┤
│  5. Token Encryption                │  → AES-256-GCM
├─────────────────────────────────────┤
│  6. Google OAuth Scopes             │  → business.manage
└─────────────────────────────────────┘
```

## Post Types Validation

```
STANDARD Post
  ✓ summary (required, max 1500 chars)
  ✓ languageCode (default: "en")
  ○ callToAction (optional)

EVENT Post
  ✓ summary (required)
  ✓ event.title (required)
  ✓ event.schedule.startDate (required)
  ○ event.schedule.endDate (optional)
  ○ callToAction (optional)

OFFER Post
  ✓ summary (required)
  ✓ offer.termsConditions (required)
  ○ offer.couponCode (optional)
  ○ offer.redeemOnlineUrl (optional)
  ○ callToAction (optional)
```

## Error Handling Strategy

```
┌─────────────────────────────────────────────┐
│  API Error                                  │
├─────────────────────────────────────────────┤
│  • Log detailed error with context          │
│  • Return user-friendly error message       │
│  • Include error code for debugging         │
│  • Don't expose sensitive details           │
└─────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────┐
│  Batch Operations (Sync)                    │
├─────────────────────────────────────────────┤
│  • Process each location independently      │
│  • Continue on individual failures          │
│  • Collect all errors                       │
│  • Return comprehensive statistics          │
└─────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────┐
│  Database Operations                        │
├─────────────────────────────────────────────┤
│  • Use upsert for sync (handle duplicates)  │
│  • Don't fail on storage errors             │
│  • Log storage failures separately          │
│  • Continue processing                      │
└─────────────────────────────────────────────┘
```

## Future Enhancements

```
┌────────────────────────────────────────────┐
│  Phase 2: Scheduled Publishing             │
├────────────────────────────────────────────┤
│  • Create posts with future publish_at     │
│  • Background job checks schedules         │
│  • Publishes at scheduled time             │
│  • Retry logic for failures                │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│  Phase 3: AI Generation Integration        │
├────────────────────────────────────────────┤
│  • Connect to AI generation pipeline       │
│  • Store in post_candidates                │
│  • Approval workflow (auto_create mode)    │
│  • Autopilot with guardrails               │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│  Phase 4: Analytics & Performance          │
├────────────────────────────────────────────┤
│  • Fetch post metrics from Google          │
│  • Track views, clicks, calls per post     │
│  • Store in post_metrics table             │
│  • Dashboard charts and insights           │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│  Phase 5: Media Management                 │
├────────────────────────────────────────────┤
│  • Upload images to Google Media API       │
│  • Image optimization and resizing         │
│  • Media library management                │
│  • Attach media to posts                   │
└────────────────────────────────────────────┘
```

## Technology Stack

```
Backend Framework:     Next.js 15 (App Router)
Language:             TypeScript (strict mode)
Database:             Supabase (PostgreSQL)
Security:             Row-Level Security (RLS)
Authentication:       Google OAuth 2.0
Encryption:           AES-256-GCM
API Integration:      Google My Business API v4
Testing:              tsx (TypeScript execution)
```

## File Organization

```
apps/web/
├── src/
│   ├── app/
│   │   └── api/
│   │       ├── sync/posts/route.ts        # Sync endpoint
│   │       └── posts/create/route.ts      # Create endpoint
│   ├── lib/
│   │   ├── google-business.ts             # API functions
│   │   ├── encryption.ts                  # Token encryption
│   │   └── supabase-server.ts             # DB clients
│   └── types/
│       └── database.ts                    # Generated types
├── test-posts-direct.ts                   # Direct test
├── test-posts-api.ts                      # API test
├── POSTS_API_SUMMARY.md                   # Overview
├── POSTS_API_IMPLEMENTATION.md            # Detailed docs
├── POSTS_QUICK_REFERENCE.md               # Quick guide
└── POSTS_ARCHITECTURE.md                  # This file
```
