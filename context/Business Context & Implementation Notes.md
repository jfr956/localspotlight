# LocalSpotlight - Business Context & Implementation Notes

**Purpose:** This document provides supporting business context, security requirements, user flows, and operational considerations to supplement the primary technical specification in `local-928c70a6_plan.md`.

**Note:** In case of conflicts, `local-928c70a6_plan.md` is the source of truth for technical implementation.

---

## 1. Business Goals & Success Metrics

### Primary Business Objective

Achieve a **25% average quarter-over-quarter uplift** in target GBP performance metrics for all client organizations actively utilizing the AI generation engine.

### Key Performance Indicators (KPIs)

**Conversion Metrics (Priority 1):**

- `ACTIONS_PHONE` - Direct phone calls from GBP
- `ACTIONS_WEBSITE` - Website visits from GBP
- Track via Google Business Profile Performance API

**Operational Metrics (Priority 2):**

- Content generation → approval rate
- Time-to-approval (target: <24 hours)
- Scheduled → published success rate (target: >95%)
- Per-location content cadence (target: 3-5 posts/week)

**Why These Metrics Matter:**
Traditional SEO metrics (impressions, organic traffic) are declining due to AI search evolution. Focus on **verifiable transactional activity** rather than vanity metrics. The platform's ROI must be demonstrable through direct customer actions.

### Success Measurement Shift

- ❌ Don't focus on: Profile views, search impressions alone
- ✅ Do focus on: Phone calls, website clicks, direction requests
- Goal: Prove that AI-generated content drives real business outcomes

---

## 2. Security & Compliance Requirements

### Multi-Tenant Security (P0 Critical)

**Requirement:** Establish and maintain absolute data isolation between all client organizations at the database level.

**Implementation Pattern:**

```
1. Every table MUST have org_id column
2. RLS policies enforce org_id filtering on ALL queries
3. JWT tokens MUST include org_id claim
4. Zero-trust principle: Never rely on application-layer filtering alone
```

**Security Checklist:**

- [ ] JWT-based authentication with org_id in custom claims
- [ ] RLS policies on every table (no exceptions)
- [ ] Row-level testing: User from Org A cannot access Org B data
- [ ] Audit logging of all cross-org query attempts
- [ ] Service role key protected and never exposed to client
- [ ] Encrypted storage for Google refresh tokens

**Testing Requirements:**

- Write tests that attempt cross-org access and verify denial
- Test with service role to ensure RLS still applies
- Simulate compromised JWT to verify isolation holds
- Test cascade deletes respect org boundaries

### Data Protection

- **PII Handling:** Never invent phone numbers/emails in AI content; redact if necessary in review replies
- **Encryption:** Google refresh tokens must be encrypted at rest
- **Token Rotation:** Implement refresh token rotation; handle revocation gracefully
- **Audit Trail:** Log all AI outputs, approvals, and edits with actor_id

---

## 3. User Flows & Use Cases

### Flow 1: Automated Weekly Posts

**Actor:** Content Manager

1. **Setup** (one-time)
   - Connect Google account via OAuth
   - Select locations to manage
   - Set brand voice preferences
   - Enable auto-posting or approval queue

2. **Weekly Automation** (background job)
   - System generates 3-5 post candidates per location
   - Grounds content in location data (services, recent posts, reviews)
   - Runs moderation checks
   - Places in approval queue OR auto-publishes (based on settings)

3. **Review & Approve** (optional)
   - Manager sees posts in approval queue
   - Can edit, approve, or reject
   - Approved posts move to scheduler

4. **Publishing**
   - Scheduler publishes at optimal times
   - Tracks success/failure
   - Updates content calendar
   - Logs to audit trail

**Success Criteria:** Manager spends <10 minutes/week per location on content management.

---

### Flow 2: Review Response Assistant

**Actor:** Content Manager or Owner

1. **New Review Arrives**
   - Real-time notification via webhook or polling
   - System fetches review details (rating, text, author)
   - AI generates draft response based on:
     - Review sentiment (positive/negative/neutral)
     - Brand voice settings
     - Review reply best practices

2. **Manager Review**
   - Receives notification (email/in-app)
   - Sees review + AI-generated draft side-by-side
   - Options:
     - ✅ Approve (publish immediately)
     - ✏️ Edit and approve
     - 🔄 Regenerate with different tone
     - ❌ Skip/delete

3. **Publishing**
   - Approved reply posted via GBP API
   - Tracks response time metrics
   - Updates review state to "replied"

**Success Criteria:** 90%+ of reviews receive responses within 24 hours; 70%+ use AI drafts with minimal edits.

---

### Flow 3: Profile Audit & Optimization

**Actor:** Admin or Content Manager

1. **Run Audit**
   - Select one or multiple locations
   - System checks:
     - Profile completeness (description, hours, categories)
     - Content freshness (last post date, Q&A activity)
     - Media quality (image count, descriptions)
     - Review response rate
     - Compliance with GBP policies

2. **Receive Recommendations**
   - Dashboard shows completeness score
   - Prioritized action items:
     - 🔴 Critical: Missing business description
     - 🟡 Important: No posts in 30+ days
     - 🟢 Optimization: Add 3 more Q&As
   - AI suggests specific fixes with drafts

3. **Apply Fixes**
   - One-click to generate missing content
   - Approve and publish batch updates
   - Re-run audit to verify improvements

**Success Criteria:** New locations reach 90%+ profile completeness within 48 hours of onboarding.

---

### Flow 4: Q&A Management

**Actor:** Content Manager

1. **AI Suggestion**
   - System analyzes location data + common industry questions
   - Generates 5-10 relevant Q&A pairs
   - Grounds answers in business details (hours, services, policies)

2. **Review Queue**
   - Manager sees suggested Q&As
   - Can edit questions or answers
   - Approves relevant ones (typically 3-5)

3. **Publishing**
   - System posts question via GBP Q&A API (as business owner)
   - Immediately posts answer
   - Tracks Q&A as "proactive content"

**Success Criteria:** Each location has 10+ helpful Q&As within first week; adds 2-3 new Q&As monthly.

---

### Flow 5: Monthly Client Reporting

**Actor:** Agency Admin

1. **Automated Report Generation**
   - Runs on 1st of each month
   - Compiles per-location:
     - Posts published (count, types)
     - Reviews received + response rate
     - Q&As added
     - Performance metrics (calls, clicks, directions)
     - Week-over-week trends

2. **Review & Customize**
   - Admin previews report
   - Can add notes or highlights
   - Whitelabel with agency branding

3. **Distribution**
   - Email PDF to client stakeholders
   - Archive in system for reference
   - Generate executive summary dashboard link

**Success Criteria:** Zero manual effort to generate reports; clients clearly see ROI.

---

## 4. API Management & Rate Limiting

### Google API Strategy

**Challenge:** Google Business Profile API has quotas; managing 100+ profiles risks hitting limits.

**Solutions:**

1. **Request Staggering**

   ```
   - Batch posts across profiles with 30-60 second delays
   - Don't publish to all 100 locations simultaneously
   - Distribute scheduled posts across the hour
   ```

2. **Retry Logic**

   ```
   - Exponential backoff: 1s → 2s → 4s → 8s
   - Max 5 retries per request
   - Move to dead-letter queue after failures
   - Alert admin on persistent failures
   ```

3. **Circuit Breaker Pattern**

   ```
   - If 5 consecutive failures detected → pause org's automation
   - Wait 15 minutes before retry
   - Send notification to org admin
   - Log incident for investigation
   ```

4. **Quota Monitoring**
   ```
   - Track daily API usage per org
   - Warn at 70% of daily quota
   - Throttle at 90% of quota
   - Reset counters at midnight UTC
   ```

### OpenAI API Management

**Cost Control:**

- Default to GPT-4o-mini (cheaper, faster)
- Escalate to GPT-4o only for:
  - JSON parse failures after 2 attempts
  - Low confidence scores
  - Complex briefs (>2000 tokens)
- Cache prompt results: hash(prompt + grounding) → TTL 7-30 days

**Rate Limits:**

- Batch content generation where possible
- Use streaming for long responses
- Set org-level spending caps
- Alert at 80% of monthly budget

### Compliance Safeguards

**Content Moderation:**

- Run OpenAI's `omni-moderation-latest` on all AI outputs
- Block content flagged as:
  - Hate speech
  - Violence
  - Sexual content
  - Self-harm
- Log moderation failures for review

**GBP Policy Checks:**

- No misleading claims (verify against business data)
- No promotional language in Q&A answers
- Event posts must have valid dates
- Offer posts must have clear terms
- Images meet size/format requirements
- No invented contact info (phone/email)

**Anti-Spam Protection:**

- Limit posts to 5/day per location (Google recommendation)
- Minimum 2-hour gap between posts
- Prevent duplicate content across locations
- Warn if content too similar to recent posts

---

## 5. Operational Excellence

### Background Jobs Architecture

**Critical Jobs:**

1. **Google Sync** (every 6-24 hours)
   - Fetch new reviews, Q&As, media
   - Update location metadata
   - Refresh performance metrics

2. **Content Scheduler** (every 5 minutes)
   - Check for posts with `publish_at <= NOW()`
   - Attempt publishing via adapter
   - Update status and retry on failure

3. **Token Refresh** (daily)
   - Refresh Google OAuth tokens before expiry
   - Rotate and re-encrypt
   - Alert on revocation

4. **Performance Ingest** (nightly)
   - Pull GBP performance data
   - Calculate daily rollups
   - Store for analytics/reporting

**Job Monitoring:**

- Track execution time, success rate, error patterns
- Dead-letter queue for failed jobs (manual review)
- Alert on 3+ consecutive failures
- Dashboard showing job health status

### Observability

**Key Metrics to Track:**

- Request latency (p50, p95, p99)
- Error rates by endpoint
- AI generation cost per org
- Content approval velocity
- Publishing success rate
- API quota utilization

**Alerting Thresholds:**

- 🚨 Critical: RLS bypass attempt, OAuth token leak, 5xx error rate >1%
- ⚠️ Warning: API quota at 80%, job failures >10%, slow queries >2s
- ℹ️ Info: New org signup, high AI costs, unusual usage patterns

---

## 6. Edge Cases & Mitigations

### Posts API Uncertainty

**Risk:** Google's Posts API access may be restricted for some accounts.

**Mitigation (Adapter Pattern):**

- **Mode A:** Direct API publishing (if available)
- **Mode B:** Manual assist workflow
  - Store approved content in system
  - Email/Slack reminder with formatted content
  - One-click "Copy to clipboard"
  - Track as "published (manual)" in calendar
  - Optional Zapier integration for export

### Brand Safety Concerns

**Risk:** AI generates off-brand or policy-violating content.

**Mitigation:**

- Moderation + human approval required by default
- Brand voice settings (tone, banned terms, required elements)
- Content policy checks before showing to user
- Audit trail of all AI outputs
- Easy one-click reject and regenerate

### Cost Runaway

**Risk:** Heavy AI usage could exceed budget.

**Mitigation:**

- Org-level spending caps
- Aggressive caching (dedupe similar requests)
- Model tiering (cheaper models first)
- Usage dashboard for admins
- Auto-throttle at budget limits

### Google Account Suspension

**Risk:** Overly aggressive posting could trigger spam detection.

**Mitigation:**

- Post frequency limits (5/day max per location)
- Minimum time gaps between posts (2 hours)
- Content uniqueness checks
- Follows GBP posting best practices
- Gradual ramp-up for new accounts

---

## 7. Success Indicators (90 Days Post-Launch)

**Platform Health:**

- ✅ 95%+ uptime
- ✅ Zero cross-org data leaks
- ✅ <500ms average API response time
- ✅ All background jobs completing on schedule

**User Adoption:**

- ✅ 70%+ of locations have auto-posting enabled
- ✅ 50%+ of review replies use AI drafts
- ✅ Average 3+ posts/week per active location
- ✅ 80%+ content approval rate (AI quality indicator)

**Business Impact:**

- ✅ 25% QoQ uplift in ACTIONS_PHONE + ACTIONS_WEBSITE (primary goal)
- ✅ 40% reduction in time spent on GBP management
- ✅ 90%+ profile completeness across all locations
- ✅ <24hr average review response time

---

## 8. Implementation Priorities

### Phase 1: Foundation (Weeks 1-3)

Focus: Security, auth, basic AI pipeline

- ✅ Supabase auth + RLS on all tables
- ✅ Google OAuth with offline access
- ✅ AI service with GPT-4o-mini + moderation
- ✅ Brand voice settings UI
- ✅ Basic post generation + approval queue

### Phase 2: Automation (Weeks 4-6)

Focus: Scheduler, jobs, publishing

- ✅ Content scheduler + calendar UI
- ✅ Review reply assistant
- ✅ Q&A generation and publishing
- ✅ Background job system (sync, scheduler)
- ✅ Posting adapter (Mode A/B)

### Phase 3: Analytics & Polish (Weeks 7-8)

Focus: Reporting, performance, optimization

- ✅ GBP Performance API integration
- ✅ Analytics dashboard (basic KPIs)
- ✅ Client reporting generator
- ✅ Profile audit tool
- ✅ Observability (logs, metrics, alerts)

---

## 9. Reference Architecture Decisions

**Why Next.js App Router:**

- Server-side rendering for SEO
- API routes for backend logic
- Edge functions for global performance
- Built-in TypeScript support
- Vercel deployment simplicity

**Why Supabase:**

- Managed Postgres (no ops overhead)
- Built-in RLS (critical for multi-tenant)
- Real-time subscriptions (review alerts)
- pgvector for RAG embeddings
- Authentication out of the box
- Storage for media files

**Why GPT-4o-mini as Default:**

- 80% cheaper than GPT-4o
- Sufficient for most content generation
- Fast response times (<2s)
- Can escalate to GPT-4o when needed
- Proven JSON schema support

**Why DALL·E 3:**

- High-quality branded images
- Follows text prompts well
- Integrated with OpenAI API
- Meets GBP image requirements
- Cost-effective at scale

---

## 10. Questions to Resolve During Build

- [ ] What is optimal post frequency per location? (start: 3-5/week)
- [ ] Should Q&A posting be automatic or approval-only? (start: approval-only)
- [ ] How long should content cache TTL be? (start: 7 days)
- [ ] When to escalate to GPT-4o? (start: JSON errors + low confidence)
- [ ] What triggers "low confidence" flag? (start: model's own confidence scores)
- [ ] Should images be generated for all posts? (start: yes, unless user disables)
- [ ] How to handle posts API unavailable? (start: Mode B fallback immediately)

---

## Related Documents

- **Primary Specification:** `local-928c70a6_plan.md` (technical implementation details)
- **This Document:** Business context, user flows, operational strategies
- **Conflict Resolution:** If this document conflicts with the primary spec, follow `local-928c70a6_plan.md`

---

**Last Updated:** October 17, 2025  
**Version:** 1.0
