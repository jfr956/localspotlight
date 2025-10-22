# LocalSpotlight Implementation Roadmap

## Overview

This roadmap outlines the implementation plan for LocalSpotlight based on the corrected understanding that **all Google Business Profile APIs are functional** with proper access approval.

**Key Insight:** Full automation is possible - we just need to apply for API access approval first.

## Current Status

### ✅ What's Working Now

- Google OAuth authentication
- Location sync and management
- Q&A management (until Nov 3, 2025)
- AI content generation
- Approval workflows
- Multi-location management

### ⏳ What Requires API Access Approval

- Review reading and reply posting
- Post creation and scheduling
- Media upload and management
- Full automation workflows

## Phase 1: API Access Approval (Week 1)

### Immediate Actions

**Day 1: Submit API Access Request**

- Fill out Google Business Profile API access form
- Use business email (not @gmail.com)
- Describe LocalSpotlight use case
- Include Project ID: 617438211159
- **Timeline:** 14 days for approval

**Day 2-14: Prepare Implementation**

- Update `google-business.ts` with new API functions
- Create database migrations for new tables
- Plan UI components for automation features
- Design error handling and retry logic

### Files to Prepare

```typescript
// apps/web/src/lib/google-business.ts - Add these functions
export async function fetchReviews(accountId: string, locationId: string, oauth2Client: any);
export async function postReviewReply(
  accountId: string,
  locationId: string,
  reviewId: string,
  comment: string,
  oauth2Client: any,
);
export async function fetchLocalPosts(accountId: string, locationId: string, oauth2Client: any);
export async function createLocalPost(
  accountId: string,
  locationId: string,
  postData: any,
  oauth2Client: any,
);
export async function uploadMedia(
  accountId: string,
  locationId: string,
  mediaData: any,
  oauth2Client: any,
);
```

## Phase 2: Data Sync Implementation (Week 2-3)

### Goal: Populate Dashboards with Real Data

**Priority 1: Review Sync (Days 15-16)**

**Implementation:**

```typescript
// Create background sync job
// apps/web/src/app/api/cron/sync-reviews/route.ts
export async function POST() {
  // 1. Get all Google connections
  // 2. For each location, call fetchReviews()
  // 3. Upsert to gbp_reviews table
  // 4. Track sync status and errors
}
```

**Database Schema:**

```sql
-- Ensure gbp_reviews table exists
create table if not exists gbp_reviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  location_id uuid not null references gbp_locations(id),
  google_review_id text not null,
  star_rating integer not null,
  review_text text,
  reviewer_name text,
  reviewer_photo_url text,
  created_at timestamptz not null,
  reply_text text,
  reply_at timestamptz,
  reply_by uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(org_id, google_review_id)
);
```

**UI Components:**

```tsx
// apps/web/src/app/(dashboard)/reviews/page.tsx
export default async function ReviewsPage() {
  const { data: reviews } = await supabase
    .from("gbp_reviews")
    .select("*")
    .order("created_at", { ascending: false });

  return <ReviewsList reviews={reviews} />;
}
```

**Success Criteria:**

- All 88 reviews for Texas Lone Star location synced
- Reviews display in dashboard with ratings, text, dates
- Sync runs every 6 hours automatically
- Error handling for failed syncs

**Priority 2: Post Sync (Days 17-18)**

**Implementation:**

```typescript
// apps/web/src/app/api/cron/sync-posts/route.ts
export async function POST() {
  // 1. Get all Google connections
  // 2. For each location, call fetchLocalPosts()
  // 3. Store in gbp_posts table for reference
  // 4. Track post performance data
}
```

**Priority 3: Media Sync (Day 19)**

**Implementation:**

```typescript
// apps/web/src/app/api/cron/sync-media/route.ts
export async function POST() {
  // 1. List existing media for each location
  // 2. Store metadata in gbp_media table
  // 3. Track what's already uploaded
}
```

## Phase 3: Review Reply Automation (Week 3-4)

### Goal: AI-Generated Review Replies Posted Automatically

**Day 20-21: Manual Reply Flow**

**Implementation:**

```typescript
// apps/web/src/app/api/reviews/[id]/reply/route.ts
export async function POST(request: Request) {
  // 1. Generate AI reply using existing logic
  // 2. Post to GBP via API
  // 3. Update gbp_reviews table
  // 4. Log action in audit_logs
}
```

**UI Components:**

```tsx
// ReviewReplyButton.tsx
<Button onClick={handleReply}>
  <MessageIcon /> Generate & Post Reply
</Button>
// Shows AI-generated reply
// User can edit before posting
// One-click post to GBP
```

**Day 22-23: Auto-create Mode**

**Implementation:**

```typescript
// Background job detects new reviews
// AI generates reply automatically
// Stores in approval queue
// User approves → posts to GBP
```

**Day 24-25: Autopilot Mode**

**Implementation:**

```typescript
// AI generates reply
// Risk score calculated
// If risk_score < threshold → auto-post
// If risk_score >= threshold → route to approval
// Notifications sent after autopublish
```

## Phase 4: Post Scheduling (Week 4-5)

### Goal: AI-Generated Posts Published Automatically

**Day 26-27: Content Generation**

**Implementation:**

```typescript
// Use existing AI generation logic
// Store in post_candidates table
// User approval workflow
// Generate images via runware.ai
```

**Day 28-29: Manual Publishing**

**Implementation:**

```typescript
// apps/web/src/app/api/posts/[id]/publish/route.ts
export async function POST() {
  // 1. Get post candidate
  // 2. Upload image to GBP via Media API
  // 3. Create post via Posts API
  // 4. Update schedules table
}
```

**Day 30-31: Scheduled Publishing**

**Implementation:**

```typescript
// apps/web/src/app/api/cron/publish-posts/route.ts
export async function POST() {
  // 1. Check schedules for pending posts
  // 2. Post via API at scheduled time
  // 3. Handle failures with retry logic
  // 4. Update status and send notifications
}
```

## Phase 5: Media Upload (Week 5)

### Goal: AI-Generated Images Uploaded to GBP

**Day 32-33: Image Upload**

**Implementation:**

```typescript
// apps/web/src/lib/google-business.ts
export async function uploadMedia(
  accountId: string,
  locationId: string,
  imageData: Buffer,
  metadata: any,
) {
  // 1. Upload image to GBP via Media API
  // 2. Categorize photo (COVER, LOGO, etc.)
  // 3. Return media ID for post attachment
}
```

**Day 34-35: Integration**

**Implementation:**

```typescript
// Integrate with post creation flow
// Auto-attach images to posts
// Manage photo libraries
// Bulk photo operations
```

## Phase 6: Performance Analytics (Week 6)

### Goal: Prove ROI with Performance Data

**Day 36-37: Performance API Integration**

**Implementation:**

```typescript
// apps/web/src/app/api/cron/sync-performance/route.ts
export async function POST() {
  // 1. Fetch performance metrics via Performance API
  // 2. Store daily rollups in analytics table
  // 3. Calculate conversion metrics
  // 4. Generate reports
}
```

**Day 38-39: Analytics Dashboard**

**Implementation:**

```tsx
// PerformanceDashboard.tsx
// Charts showing calls, clicks, directions
// Before/after comparisons
// ROI calculations
// Automated reports
```

## Phase 7: Advanced Features (Week 7-8)

### Goal: Enterprise-Level Automation

**Week 7: Advanced Automation**

- **Circuit Breakers:** Pause automation after repeated failures
- **Rate Limiting:** Stagger requests across locations
- **Quota Monitoring:** Track API usage and warn at limits
- **Error Recovery:** Automatic retry with exponential backoff

**Week 8: User Experience**

- **Sync Status:** Show last synced, sync in progress
- **Manual Refresh:** Allow users to trigger syncs
- **Bulk Operations:** Process multiple locations at once
- **Mobile Optimization:** Responsive design for mobile workflows

## Database Schema Updates

### New Tables Needed

```sql
-- Track manual posting workflow
create table manual_post_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  post_candidate_id uuid references post_candidates(id),
  action text not null, -- 'copied', 'downloaded_image', 'marked_posted'
  created_at timestamptz default now()
);

-- Track review manual imports
create table review_imports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  location_id uuid references gbp_locations(id),
  import_method text not null, -- 'manual', 'csv', 'email', 'api'
  review_count int,
  created_at timestamptz default now()
);

-- Performance analytics
create table performance_metrics (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  location_id uuid not null references gbp_locations(id),
  date date not null,
  views int default 0,
  clicks int default 0,
  calls int default 0,
  directions int default 0,
  created_at timestamptz default now(),
  unique(org_id, location_id, date)
);
```

### Existing Table Updates

```sql
-- Add manual workflow fields to schedules
alter table schedules add column manual_posted_at timestamptz;
alter table schedules add column reminder_sent_at timestamptz;
alter table schedules add column reminder_method text; -- 'email', 'slack', 'both'

-- Add import source to gbp_reviews
alter table gbp_reviews add column import_source text; -- 'api', 'manual', 'csv', 'email'

-- Add backup flag to gbp_qna
alter table gbp_qna add column is_exported boolean default false;
alter table gbp_qna add column last_exported_at timestamptz;
```

## API Endpoints to Build

### Review Workflows

```typescript
// Manual review entry
POST /api/reviews/manual-entry
Request: {
  location_id: string,
  star_rating: number,
  review_text: string,
  author_name: string,
  review_date: string
}
Response: { review_id: string }

// Generate reply
POST /api/reviews/[id]/generate-reply
Response: { reply_text: string, risk_score: number }

// Post reply
POST /api/reviews/[id]/reply
Request: { reply_text: string }
Response: { success: boolean }
```

### Post Workflows

```typescript
// Create post candidate
POST /api/posts/create
Request: { location_id: string, content: any }
Response: { post_id: string }

// Publish post
POST /api/posts/[id]/publish
Request: { scheduled_at?: string }
Response: { success: boolean }

// Schedule post
POST /api/posts/[id]/schedule
Request: { scheduled_at: string }
Response: { success: boolean }
```

### Media Workflows

```typescript
// Upload media
POST /api/media/upload
Request: FormData (image file)
Response: { media_id: string, url: string }

// List media
GET /api/media?location_id=xxx
Response: { media: Media[] }
```

## Testing Strategy

### Unit Tests

```typescript
// Test API functions
describe("Google Business API", () => {
  test("fetchReviews returns correct format", async () => {
    const reviews = await fetchReviews(accountId, locationId, oauth2Client);
    expect(reviews).toHaveProperty("reviews");
    expect(Array.isArray(reviews.reviews)).toBe(true);
  });

  test("postReviewReply succeeds", async () => {
    const result = await postReviewReply(
      accountId,
      locationId,
      reviewId,
      "Thank you!",
      oauth2Client,
    );
    expect(result.success).toBe(true);
  });
});
```

### Integration Tests

```typescript
// Test full workflows
describe("Review Reply Workflow", () => {
  test("complete workflow from review to reply", async () => {
    // 1. Sync reviews
    // 2. Generate AI reply
    // 3. Post reply to GBP
    // 4. Verify reply appears in GBP
  });
});
```

### E2E Tests

```typescript
// Test user workflows
describe("Review Management", () => {
  test("user can reply to review", async () => {
    // 1. Login as user
    // 2. Navigate to reviews
    // 3. Click reply button
    // 4. Verify reply posted
  });
});
```

## Success Metrics

### Technical Metrics

- **API Success Rate:** >95% for all endpoints
- **Sync Performance:** <30 seconds for 100 locations
- **Error Recovery:** <5% manual intervention required
- **Uptime:** >99.9% for background jobs

### User Experience Metrics

- **Review Reply Time:** <2 seconds from click to posted
- **Post Creation Time:** <5 seconds for AI generation
- **Dashboard Load Time:** <3 seconds for all data
- **Mobile Performance:** <5 seconds on mobile devices

### Business Metrics

- **Customer Satisfaction:** >80% satisfied with automation
- **Feature Adoption:** >70% use automation features
- **Time Savings:** >90% reduction vs. manual workflows
- **ROI Proof:** 25% QoQ uplift in conversion metrics

## Risk Mitigation

### Technical Risks

**API Rate Limiting:**

- Implement exponential backoff
- Stagger requests across locations
- Monitor quota usage
- Circuit breakers after failures

**Data Quality:**

- Validate all data before posting
- Check for PII in AI content
- Enforce GBP policies
- Test replies before autopilot

**Error Handling:**

- Graceful degradation on API failures
- Manual fallback workflows
- Comprehensive logging
- User notifications for issues

### Business Risks

**User Expectations:**

- Be transparent about API limitations
- Emphasize "AI-assisted" not "automated"
- Focus on time savings (10x faster)
- Provide exceptional UX for manual steps

**Competitive Pressure:**

- Focus on AI quality (hard to replicate)
- Build strong brand trust (transparency)
- Expand to other platforms (Facebook, Instagram)
- Excel at UX (fastest workflows)

## Deployment Strategy

### Development Environment

```bash
# Local development
pnpm db:start
pnpm dev

# Test with local Supabase
# Use test Google OAuth credentials
# Mock API responses for development
```

### Staging Environment

```bash
# Deploy to Vercel preview
vercel --env=staging

# Use staging Supabase project
# Use staging Google OAuth
# Test with real API calls
```

### Production Environment

```bash
# Deploy to production
vercel --prod

# Use production Supabase
# Use production Google OAuth
# Monitor API usage closely
```

## Monitoring & Alerting

### API Monitoring

- **Quota Usage:** Alert at 70% of quota
- **Error Rates:** Alert if >5% failure rate
- **Response Times:** Alert if >10 seconds
- **Sync Status:** Alert if sync fails 3+ times

### Business Monitoring

- **User Activity:** Track feature usage
- **Content Quality:** Monitor AI output quality
- **Customer Satisfaction:** Regular surveys
- **ROI Metrics:** Track conversion improvements

## Conclusion

This roadmap provides a clear path to full GBP automation for LocalSpotlight. The key is understanding that all APIs work - we just need to apply for access approval first.

**Timeline Summary:**

- **Week 1:** Apply for API access
- **Week 2-3:** Implement data sync
- **Week 3-4:** Build review automation
- **Week 4-5:** Build post scheduling
- **Week 5:** Implement media upload
- **Week 6:** Add performance analytics
- **Week 7-8:** Advanced features and polish

**Success depends on:**

1. Getting API access approval quickly
2. Building robust error handling
3. Creating exceptional user experience
4. Proving ROI through analytics
5. Maintaining high AI content quality

With this roadmap, LocalSpotlight can achieve full automation parity with enterprise competitors while maintaining our advantage in AI content quality and user experience.


