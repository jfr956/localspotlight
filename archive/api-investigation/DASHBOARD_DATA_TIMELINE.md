# When Will Dashboards Have Data? - Implementation Timeline

## Current Status (Right Now)

### What's Already Populated ✅
- **Locations:** 2 locations synced and showing
  - kreativ solutions
  - Texas Lone Star AC & Heating LLC

### What's Empty (Needs Implementation) ❌
- **Reviews:** 0 reviews (API works, just need to sync)
- **Q&A:** 0 questions (API works, just need to sync)
- **Posts:** Not yet synced
- **Analytics:** Not yet implemented

## Timeline to Get Data Showing

### Option 1: Quick Win - Reviews (Fastest Impact)

**Time to dashboard:** **4-6 hours of development**

**What you'll see:**
- All 88 reviews for Texas Lone Star location
- Star ratings, review text, author names
- Existing replies
- Review dates and sentiment

**Implementation steps:**
1. Add `fetchReviews()` function to `google-business.ts` (30 min)
2. Create API route `/api/sync/reviews` (30 min)
3. Create background job to sync every 6 hours (1 hour)
4. Build reviews dashboard page (2-3 hours)

**Files to create/modify:**
```
✏️ apps/web/src/lib/google-business.ts - Add fetchReviews()
📄 apps/web/src/app/api/sync/reviews/route.ts - New file
📄 apps/web/src/app/api/cron/sync-reviews/route.ts - New file
✏️ apps/web/src/app/(dashboard)/reviews/page.tsx - Build UI
```

### Option 2: Posts & Content (Medium Timeline)

**Time to dashboard:** **2-3 days of development**

**What you'll see:**
- 20 existing posts from Texas Lone Star
- Post content, dates, performance
- Ability to create new posts
- Scheduled post calendar

**Implementation steps:**
1. Add `fetchPosts()` and `createPost()` to library (1-2 hours)
2. Create sync job (1-2 hours)
3. Build post creation UI (4-6 hours)
4. Build post calendar/scheduling UI (4-6 hours)
5. Create publish automation (4-6 hours)

### Option 3: Complete Dashboard (Full Feature Set)

**Time to dashboard:** **1-2 weeks of development**

**What you'll see:**
- All reviews with reply functionality
- All posts with creation/scheduling
- Q&A management
- Performance analytics
- Media library
- Automation controls

## Recommended Implementation Order

### Phase 1: Data Visibility (Days 1-2)
**Goal:** Show real data in dashboards ASAP

**Priority 1 - Reviews Sync (Day 1)**
- ⏰ Development time: 4-6 hours
- 📊 Impact: HIGH - reviews are critical for reputation management
- 🎯 Result: Dashboard shows 88 reviews immediately after sync

**Priority 2 - Q&A Sync (Day 1-2)**
- ⏰ Development time: 3-4 hours (similar to reviews)
- 📊 Impact: MEDIUM - useful but less critical than reviews
- 🎯 Result: Dashboard shows all Q&A data

**Priority 3 - Posts Sync (Day 2)**
- ⏰ Development time: 2-3 hours (read-only first)
- 📊 Impact: MEDIUM - nice to see existing posts
- 🎯 Result: Dashboard shows post history

### Phase 2: Action Capabilities (Days 3-7)
**Goal:** Enable users to DO things

**Priority 1 - Review Reply UI (Days 3-4)**
- ⏰ Development time: 1-2 days
- 📊 Impact: HIGH - core feature for customers
- 🎯 Result: Users can post replies to reviews

**Priority 2 - Post Creation (Days 5-6)**
- ⏰ Development time: 1-2 days
- 📊 Impact: HIGH - core feature for customers
- 🎯 Result: Users can create and publish posts

**Priority 3 - Media Upload (Day 7)**
- ⏰ Development time: 1 day
- 📊 Impact: MEDIUM - needed for posts with images
- 🎯 Result: Users can upload AI-generated images

### Phase 3: Automation (Week 2)
**Goal:** AI-powered automation workflows

**Priority 1 - AI Reply Generation (Days 8-10)**
- ⏰ Development time: 2-3 days
- 📊 Impact: HIGH - key differentiator
- 🎯 Result: One-click AI-generated review replies

**Priority 2 - Post Scheduling (Days 11-12)**
- ⏰ Development time: 1-2 days
- 📊 Impact: MEDIUM - convenience feature
- 🎯 Result: Schedule posts days/weeks in advance

**Priority 3 - Autopilot Mode (Days 13-14)**
- ⏰ Development time: 2 days
- 📊 Impact: HIGH - ultimate automation
- 🎯 Result: Fully automated review replies + posts

## Minimum Viable Dashboard (1-2 Days)

If you want data showing ASAP, here's the absolute minimum:

### Day 1 Morning (4 hours)
**Implement reviews sync:**
```typescript
// In google-business.ts
export async function fetchReviews(
  refreshToken: string,
  accountId: string,
  locationId: string
) {
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const url = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews`;
  const response = await oauth2Client.request({ url, method: 'GET' });

  return response.data.reviews || [];
}
```

**Create sync route:**
```typescript
// apps/web/src/app/api/sync/reviews/route.ts
export async function POST(request: Request) {
  // 1. Get all connections
  // 2. For each location, call fetchReviews()
  // 3. Upsert to gbp_reviews table
  // 4. Return success/failure counts
}
```

**Test:** Run once manually → see 88 reviews in database

### Day 1 Afternoon (4 hours)
**Build simple reviews page:**
```tsx
// apps/web/src/app/(dashboard)/reviews/page.tsx
export default async function ReviewsPage() {
  const { data: reviews } = await supabase
    .from('gbp_reviews')
    .select('*')
    .order('created_at', { ascending: false });

  return <ReviewsList reviews={reviews} />;
}
```

**Result:** Dashboard shows all 88 reviews with ratings, text, dates

### Day 2 (Optional - Q&A sync)
- Copy review sync logic for Q&A
- Build Q&A dashboard page
- Result: Both reviews and Q&A showing

## What Data Will Show After Each Step

### After Review Sync (First Sync Takes ~30 seconds)
```
Dashboard → Reviews
├── 88 reviews displayed
├── Average rating: 4.7 stars
├── Review text and dates
├── Reviewer names
├── Existing replies shown
└── Filterable by rating, date
```

### After Post Sync
```
Dashboard → Posts
├── 20 posts displayed
├── Post content and type
├── Published dates
├── Performance data (if available)
└── Media attachments
```

### After Q&A Sync
```
Dashboard → Q&A
├── All questions listed
├── Existing answers shown
├── Question dates
├── Upvote counts
└── Unanswered questions highlighted
```

## Technical Implementation Details

### Review Sync Function (Complete Code)

```typescript
// Add to apps/web/src/lib/google-business.ts

interface Review {
  reviewId: string;
  reviewer: {
    profilePhotoUrl?: string;
    displayName?: string;
  };
  starRating: 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE';
  comment?: string;
  createTime: string;
  updateTime: string;
  reviewReply?: {
    comment: string;
    updateTime: string;
  };
}

export async function fetchReviews(
  refreshToken: string,
  accountId: string,
  locationId: string
): Promise<Review[]> {
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const url = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews`;

  try {
    const response = await oauth2Client.request<{ reviews: Review[] }>({
      url,
      method: 'GET',
    });

    return response.data.reviews || [];
  } catch (error) {
    console.error('[fetchReviews] Error:', error);
    throw error;
  }
}
```

### Database Storage (What Gets Saved)

When reviews sync, this data populates `gbp_reviews`:

```sql
-- Sample data after sync
id, org_id, location_id, google_review_id, star_rating, review_text, reviewer_name, created_at, reply_text, reply_at

uuid-1, org-1, loc-1, "AbFvOqn...", 5, "The Best AC Repair...", "Tom Soiler", 2025-09-16, "Thank you...", 2025-09-16
uuid-2, org-1, loc-1, "AbFvOqn...", 2, "What seemed to be...", "Edgar Aldrete", 2023-03-04, "Thank you for...", 2023-03-04
...
```

## Sync Schedule (Production)

Once implemented, syncs run automatically:

**Reviews:**
- Initial sync: Immediate (backfill all historical reviews)
- Ongoing: Every 6 hours
- Reason: New reviews don't appear instantly, 6-hour delay is acceptable

**Q&A:**
- Initial sync: Immediate
- Ongoing: Every 12 hours
- Reason: Questions less frequent than reviews

**Posts:**
- Initial sync: Immediate (see historical posts)
- Ongoing: Once after each publish (immediate feedback)

**Performance Metrics:**
- Daily at midnight UTC
- Reason: Google provides daily rollups

## Cost Considerations

**API Calls Per Sync (1 location):**
- Reviews: 1 call
- Q&A: 1 call
- Posts: 1 call
- Total: 3 calls per location

**For 100 locations every 6 hours:**
- 300 calls per sync
- ~1,200 calls per day
- Well within 300 QPM limit (spread over 6 hours)

## Summary Answer to Your Question

**"When will dashboards have data?"**

**Absolute fastest:** 4-6 hours after starting development
- You'll see: All 88 reviews for your location
- What's working: Reviews display, filtering, sorting
- What's missing: Reply functionality, other features

**Realistic (with reply functionality):** 2-3 days
- You'll see: Reviews + ability to AI-generate and post replies
- What's working: Core review management workflow
- What's missing: Posts, Q&A, automation

**Complete feature set:** 1-2 weeks
- You'll see: Everything - reviews, posts, Q&A, automation
- What's working: Full LocalSpotlight platform
- What's missing: Nothing - ready for customers

## Immediate Action Items

**To get data showing TODAY:**

1. **Implement review sync** (priority #1)
   - Estimated time: 4-6 hours
   - Creates most immediate value
   - Customers can see their reviews

2. **Run manual sync once** to backfill
   - Call `/api/sync/reviews` endpoint
   - ~30 seconds to sync 88 reviews
   - Immediately visible in dashboard

3. **Set up cron job** for ongoing syncs
   - Vercel cron or similar
   - Runs every 6 hours
   - Keeps data fresh

**Want me to implement the review sync now?** I can create the complete code for:
- ✅ `fetchReviews()` function
- ✅ Sync API route
- ✅ Cron job
- ✅ Basic dashboard page

This would get you from 0 reviews to 88 reviews showing in ~6 hours.
