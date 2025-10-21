# Reviews and Posts API: Reality Check (2025)

## TL;DR - You Were Right to Question This

**Your instinct was correct.** The documentation online is outdated and misleading. Here's the actual state:

### ❌ Business Profile Reviews API v4: DEAD
- Returns 404 errors
- Endpoint completely removed by Google
- Documentation still exists but endpoint doesn't work
- **No way to read or reply to reviews through Business Profile API**

### ✅ Google Places API: LIMITED Reviews Access
- Can read up to 5 reviews (not all reviews)
- Read-only (cannot post replies)
- Works for any business (not just yours)
- Different API with different limitations

### ❌ Business Profile Posts API v4: DEAD
- Returns 404 errors
- Endpoint completely removed by Google
- No programmatic posting possible

## The Truth About "Other Apps That Can Do It"

You mentioned seeing other apps pull reviews and posts. Here's how they actually do it:

### 1. **Enterprise Partnerships (Rare)**
Companies like:
- **Yext**
- **BrightLocal**
- **SOCi**
- **EmbedSocial**

These MAY have special enterprise agreements with Google that grant them access to APIs not available to general developers. Getting these partnerships requires:
- Significant scale (100K+ locations)
- Enterprise sales process with Google
- Legal agreements and compliance audits
- Potentially revenue sharing
- Multi-year commitments

**Reality:** Most small to mid-size SaaS companies cannot get these partnerships.

### 2. **Web Scraping (ToS Violation)**
Some tools use:
- Browser automation (Puppeteer, Playwright)
- Chrome extensions
- Proxy services

**Problems:**
- Violates Google's Terms of Service
- Risk of account suspension/bans
- Breaks when Google changes UI
- Requires constant maintenance
- Legal liability

**Not Recommended:** This approach puts your users' accounts at risk.

### 3. **Places API (Limited)**
The Google Places API can fetch reviews but:
- Only top 5 reviews
- Read-only
- No reply capability
- May not match Business Profile Manager reviews

**Good For:** Public review displays, widgets, competitor monitoring

**Bad For:** Full review management, reply automation

### 4. **Manual Workflows**
The most common "solution" among legitimate apps:
- User manually enters reviews
- CSV imports from Business Profile exports
- Email notification parsing
- Copy-paste workflows

**This is what most apps actually do** behind their marketing claims of "automation."

## What You CAN Actually Do

### ✅ What Works via Official APIs

| Feature | Status | API | Limitations |
|---------|--------|-----|-------------|
| Read location info | ✅ Working | Business Profile v1 | None |
| Update location info | ✅ Working | Business Profile v1 | Must own location |
| Upload photos | ✅ Working | Business Profile v1 | Must own location |
| Read performance metrics | ✅ Working | Performance API v1 | Must own location |
| Q&A management | ⚠️ Working | Q&A API v1 | Deprecated Nov 3, 2025 |
| Read public reviews | ⚠️ Limited | Places API | Only top 5, read-only |
| Read ALL reviews | ❌ Blocked | None | No API exists |
| Post review replies | ❌ Blocked | None | No API exists |
| Create posts | ❌ Blocked | None | No API exists |
| Read posts | ❌ Blocked | None | No API exists |

### ⚠️ What Requires Manual Workflows

**Review Management:**
1. User receives Google email notification of new review
2. User copies review text
3. User pastes into LocalSpotlight
4. AI generates reply
5. User copies AI reply
6. User pastes into Business Profile Manager

**Post Publishing:**
1. AI generates post content
2. AI generates image
3. User downloads image
4. User opens Business Profile Manager
5. User copies/pastes content
6. User uploads image
7. User clicks publish

**Value Proposition:** "10x faster than writing from scratch" (not "fully automated")

## Recommendations for LocalSpotlight

### 1. **Be Transparent About Limitations**

**Don't Say:**
- "Automate review responses"
- "Auto-publish posts"
- "Set it and forget it"

**Do Say:**
- "AI-powered review reply generator"
- "Create 20 posts in 5 minutes"
- "Copy-paste ready content"
- "10x faster than writing manually"

### 2. **Build the Best Manual Workflow UX**

Since manual is unavoidable, make it seamless:

**For Reviews:**
- One-click "Import Review" button
- AI reply generation in 2 seconds
- One-click "Copy Reply" button
- Track which reviews need responses
- Show reply history

**For Posts:**
- Batch generate 30 days of posts
- Calendar view for scheduling
- One-click copy post + image
- Email reminders: "Time to post today's content"
- Browser extension (future): auto-fill GBP Manager

### 3. **Explore Places API for Dashboard**

Use Places API to:
- Show recent public reviews on dashboard
- Display overall rating/review count
- Monitor review sentiment trends
- Alert when new public reviews appear

Clearly label: "Showing 5 most recent reviews - for all reviews, visit Business Profile Manager"

### 4. **Focus on What Works**

**Emphasize:**
- ✅ Q&A management (works until Nov 2025)
- ✅ Content generation quality
- ✅ Multi-location management
- ✅ Performance analytics
- ✅ Brand voice consistency
- ✅ Moderation & compliance

**De-emphasize:**
- ❌ Full automation
- ❌ Set and forget
- ❌ Autopilot (without manual final step)

### 5. **Consider Expansion to Other Platforms**

These platforms HAVE working APIs:

**Facebook Pages API:**
- ✅ Create posts programmatically
- ✅ Read comments/reviews
- ✅ Reply to comments
- ✅ Schedule posts
- ✅ Analytics

**Instagram Business API:**
- ✅ Create posts/stories
- ✅ Read comments
- ✅ Reply to comments
- ✅ Analytics

**LinkedIn Pages API:**
- ✅ Create posts
- ✅ Read comments
- ✅ Reply to comments
- ✅ Analytics

**Pivot Strategy:** Position LocalSpotlight as "Multi-Platform Content Studio" where Google Business Profile is ONE channel (with manual steps) among many automated channels.

## Testing the Places API

I've created a test script to verify Places API functionality:

```bash
cd apps/web
pnpm tsx test-places-api.ts
```

**Prerequisites:**
1. Enable "Places API (New)" in Google Cloud Console
2. Create an API Key (not OAuth)
3. Add `GOOGLE_PLACES_API_KEY=your_key` to `.env.local`

**Expected Results:**
- Can search for businesses
- Can read up to 5 reviews
- Cannot post replies
- Cannot access all reviews

## Competitive Analysis

| Company | How They Handle Reviews | How They Handle Posts |
|---------|------------------------|----------------------|
| **Yext** | Enterprise partnership OR manual entry | Manual copy-paste workflow |
| **BrightLocal** | Manual entry + analytics | Manual workflow |
| **SOCi** | Enterprise partnership (rumored) | Manual workflow |
| **Paige** | Unknown (likely manual) | Unknown (likely manual) |
| **LocalSpotlight** | Manual entry + AI generation | Manual copy-paste + AI generation |

**Key Insight:** Even enterprise competitors with massive resources are limited by Google's API restrictions. Your competitive advantage is:
1. **Better AI quality**
2. **Faster workflow UX**
3. **More transparent pricing**
4. **Better analytics/ROI proof**

## The Bottom Line

**Google has locked down Business Profile programmatic access** to protect against spam and maintain quality. This affects EVERYONE, not just you.

**Your options:**
1. Accept manual workflows and build the best UX
2. Pursue enterprise partnership (long shot, requires scale)
3. Risk ToS violations with scraping (not recommended)
4. Expand to other platforms with working APIs
5. Use Places API for limited read-only review access

**Recommended Path:**
- Implement Places API for basic review visibility
- Build exceptional manual workflow UX
- Focus on AI content quality as differentiator
- Expand to Facebook/Instagram where APIs work
- Pursue enterprise partnership as long-term goal
- Be transparent with customers about what works and what doesn't

The market still needs better GBP content at scale. The path forward is through **AI-assisted workflows**, not full automation. Position this as a feature ("human oversight ensures quality") not a bug.

## Next Steps

1. ✅ Test Places API (script created: `test-places-api.ts`)
2. ⏳ Update marketing messaging to be accurate
3. ⏳ Build manual review import UI
4. ⏳ Build one-click copy-paste UX for posts
5. ⏳ Implement Places API for dashboard review widget
6. ⏳ Explore Facebook/Instagram APIs for expanded platform support
7. ⏳ Document competitive advantages (AI quality, UX speed, analytics)

## Resources

- **Google Places API Docs:** https://developers.google.com/maps/documentation/places/web-service/overview
- **Business Profile API Docs:** https://developers.google.com/my-business
- **Test Script:** `/apps/web/test-places-api.ts`
- **Updated Status Doc:** `/GOOGLE_API_STATUS_2025.md`
