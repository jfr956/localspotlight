# Google Business Profile API Access Guide

This guide explains how to check your Google Business Profile (GBP) API quota, understand access levels, and request full API access for LocalSpotlight.

## Table of Contents

- [Understanding GBP API Access Levels](#understanding-gbp-api-access-levels)
- [How to Check Your API Quota](#how-to-check-your-api-quota)
- [Interpreting Quota Values](#interpreting-quota-values)
- [Requesting Full API Access](#requesting-full-api-access)
- [What Google Requires for Approval](#what-google-requires-for-approval)
- [Troubleshooting Common Issues](#troubleshooting-common-issues)

---

## Understanding GBP API Access Levels

Google Business Profile API has two access levels:

### Read-Only Access (Default)
- **Quota:** 0 QPM (Queries Per Minute) for write operations
- **Capabilities:**
  - Read location data (name, address, hours, categories)
  - Fetch reviews and Q&A
  - Access performance metrics
  - Download media
- **Limitations:**
  - Cannot create or edit posts
  - Cannot upload photos/videos
  - Cannot post review replies
  - Cannot answer Q&A questions

### Full Access (Requires Google Approval)
- **Quota:** 300+ QPM for write operations
- **Capabilities:**
  - Everything in Read-Only Access, PLUS:
  - Create and edit GBP posts (WHATS_NEW, EVENT, OFFER)
  - Upload photos and videos
  - Post review replies
  - Answer Q&A questions
  - Update location details (hours, description, attributes)
- **Required for:** LocalSpotlight's automation features (auto-create, autopilot modes)

---

## How to Check Your API Quota

### Step 1: Access Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with the Google account that owns your GCP project
3. Select the project you're using for LocalSpotlight (check the project dropdown at the top)

### Step 2: Navigate to APIs & Services

1. Click the hamburger menu (three horizontal lines) in the top-left corner
2. Hover over **APIs & Services**
3. Click **Enabled APIs & services**

Alternatively, use this direct link (replace `YOUR_PROJECT_ID`):
```
https://console.cloud.google.com/apis/dashboard?project=YOUR_PROJECT_ID
```

### Step 3: Find Business Profile APIs

Look for these specific APIs in your enabled APIs list:

- **Google My Business API** (legacy, being deprecated)
- **My Business Business Information API**
- **My Business Lodging API**
- **My Business Notifications API**
- **My Business Place Actions API**
- **My Business Q&A API**
- **My Business Verifications API**

The key API for posts is: **My Business Business Information API**

### Step 4: Check Quota Details

1. Click on **My Business Business Information API** (or any of the APIs above)
2. Click the **Quotas** tab in the left sidebar
3. Look for these quota metrics:

   **For Read Operations:**
   - `Queries per day`
   - `Queries per minute per user`

   **For Write Operations (the critical ones):**
   - `Write requests per day`
   - `Write requests per minute per user`

### Step 5: Screenshot Your Quota (for reference)

Take a screenshot showing:
- The API name at the top
- The Quotas tab selected
- The quota values displayed

Save this for troubleshooting or support requests.

---

## Interpreting Quota Values

### What You'll See

| Quota Metric | Read-Only Access | Full Access | What It Means |
|-------------|------------------|-------------|---------------|
| **Queries per day** | 10,000+ | 10,000+ | Total API calls per day (reads + writes) |
| **Queries per minute per user** | 60 | 60 | Rate limit for read operations |
| **Write requests per day** | **0** | **1,500+** | Daily limit for creating/updating content |
| **Write requests per minute** | **0 QPM** | **300 QPM** | Rate limit for write operations |

### Key Indicators

**You Have Read-Only Access If:**
- Write requests per minute = **0 QPM**
- Write requests per day = **0** or not listed
- You can fetch data but API returns `403 Forbidden` when creating posts

**You Have Full Access If:**
- Write requests per minute = **300 QPM** or higher
- Write requests per day = **1,500+**
- You can successfully create posts, upload media, and post replies

### Testing Your Access Programmatically

Run this test in your LocalSpotlight environment:

```typescript
// Test write access by attempting to create a post
// apps/web/src/lib/test-gbp-access.ts

import { createGBPClient } from "@/lib/google-oauth";

async function testWriteAccess(connectionId: string) {
  const client = await createGBPClient(connectionId);

  try {
    // Attempt to create a test post (will fail gracefully if no write access)
    const response = await client.post(
      `https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/localPosts`,
      {
        topicType: "WHATS_NEW",
        summary: "Test post - checking API access",
        callToAction: {
          actionType: "LEARN_MORE",
          url: "https://example.com"
        }
      }
    );

    console.log("✅ Write access confirmed! Response:", response.status);
    return true;
  } catch (error) {
    if (error.response?.status === 403) {
      console.log("❌ No write access - quota is 0 QPM");
      console.log("Error message:", error.response?.data?.error?.message);
      return false;
    }
    throw error;
  }
}
```

---

## Requesting Full API Access

Google requires you to apply for access to write-enabled Business Profile APIs. Here's how:

### Step 1: Access the Request Form

Go to the official access request form:

**[Google Business Profile API Access Request Form](https://docs.google.com/forms/d/e/1FAIpQLSdJHhkajf0BVpb-uAMGPMK_6SETbMQaPjjuMMVJCm-RrmcMoQ/viewform)**

Alternative path:
1. Go to [Google Business Profile API Documentation](https://developers.google.com/my-business/content/overview)
2. Click **"Request access"** banner at the top
3. Fill out the form that appears

### Step 2: Prepare Required Information

Before starting the form, gather:

1. **Google Cloud Project ID**
   - Found in GCP Console dashboard (e.g., `localspotlight-prod-12345`)

2. **Organization Details**
   - Legal business name
   - Business website URL
   - Contact email (must match GCP project owner)
   - Phone number

3. **Use Case Description**
   - What you're building (SaaS platform for GBP content management)
   - Why you need write access (automated posting, review replies, Q&A)
   - How many locations you'll manage (estimate)
   - Expected API usage volume (QPD)

4. **OAuth Consent Screen**
   - Must be configured and verified
   - Go to: APIs & Services > OAuth consent screen
   - Complete all required fields
   - Submit for verification if needed

### Step 3: Complete the Form

Fill out each section carefully:

**Section 1: Project Information**
- GCP Project ID: `your-project-id`
- Project Name: `LocalSpotlight`
- APIs needed: Check all relevant Business Profile APIs

**Section 2: Business Information**
- Company name
- Website URL
- Primary contact email
- Business description

**Section 3: Use Case**

Example response:
```
LocalSpotlight is a SaaS platform that helps agencies manage Google Business
Profile content at scale for their clients. We need write access to:

1. Create and schedule GBP posts (WHATS_NEW, EVENT, OFFER types)
2. Post replies to customer reviews
3. Answer Q&A questions
4. Upload photos and videos to business profiles

Our platform serves marketing agencies managing 10-500 business locations
per client. We expect to make approximately 5,000-10,000 write requests
per day across all clients, with proper rate limiting and exponential
backoff implemented.

We enforce strict compliance with GBP policies through automated moderation
and human approval workflows. All content is generated with client consent
and aligns with their brand guidelines.
```

**Section 4: Technical Details**
- OAuth 2.0 client ID (from GCP Console)
- Redirect URIs configured
- Privacy Policy URL
- Terms of Service URL

**Section 5: Compliance**
- Confirm you'll follow GBP policies
- Agree to proper attribution
- Acknowledge rate limiting responsibilities

### Step 4: Submit and Wait

- **Submission:** Click "Submit" when complete
- **Confirmation:** You'll receive an email acknowledging receipt
- **Review Time:** 2-6 weeks (sometimes faster)
- **Follow-up:** Google may email additional questions
- **Approval:** You'll receive an email with next steps

### Step 5: After Approval

Once approved:

1. **Verify Quota Increase**
   - Go back to GCP Console > APIs & Services > Quotas
   - Confirm Write requests per minute shows **300 QPM** (or higher)

2. **Test Write Operations**
   - Create a test post via API
   - Upload a test image
   - Post a test review reply

3. **Enable Automation**
   - Update LocalSpotlight automation policies to allow `auto_create` and `autopilot` modes
   - Configure per-location settings

---

## What Google Requires for Approval

Google evaluates applications based on:

### 1. Legitimate Business Use Case

**Approved Use Cases:**
- Content management platforms (like LocalSpotlight)
- Review management tools
- Multi-location management systems
- Analytics and reporting platforms
- Marketing automation with human oversight

**Rejected Use Cases:**
- Spam or bulk posting tools
- Review manipulation services
- Automated bots without human oversight
- Scraping or data harvesting
- Misleading or deceptive practices

### 2. Compliance with GBP Policies

Your application must demonstrate:
- Understanding of [Google Business Profile guidelines](https://support.google.com/business/answer/3038177)
- Content moderation processes
- Human review workflows (for autopilot features)
- No fake reviews or prohibited content
- Proper business verification

### 3. Verified OAuth Consent Screen

**Required elements:**
- App name (e.g., "LocalSpotlight")
- App logo (square, at least 120x120px)
- Privacy Policy URL (publicly accessible)
- Terms of Service URL (publicly accessible)
- Authorized domains (e.g., `localspotlight.com`)
- Scopes requested:
  - `https://www.googleapis.com/auth/business.manage`

**Verification Status:**
- For internal use: Verification optional
- For external users: Must complete verification process
- Publishing status: Set to "In Production" after approval

### 4. Security and Privacy Measures

Demonstrate:
- Secure token storage (encrypted refresh tokens)
- No sharing of user data without consent
- Proper authentication and authorization
- Row-Level Security for multi-tenant isolation
- Audit logging for all API actions

### 5. Rate Limiting and Error Handling

Show you'll:
- Implement exponential backoff on errors
- Respect quota limits (no bursting)
- Stagger requests across locations
- Circuit breaker pattern for failures
- Monitor and log API usage

---

## Troubleshooting Common Issues

### Issue 1: Can't Find Business Profile APIs

**Problem:** APIs not showing in "Enabled APIs & services"

**Solution:**
1. Go to **API Library** (not "Enabled APIs")
2. Search for "My Business"
3. Enable each API individually:
   - My Business Business Information API
   - My Business Q&A API
   - My Business Verifications API
4. Refresh the "Enabled APIs" page

### Issue 2: Quotas Show as "Not Set" or "Unlimited"

**Problem:** Quota page shows no limits or "Not set"

**Solution:**
- This usually means default quotas are applied
- Default for write operations is **0 QPM** (read-only)
- You need to request access to see actual write quotas
- Check API metrics to see if writes are returning 403 errors

### Issue 3: OAuth Consent Screen Not Verified

**Problem:** Form rejects application due to unverified consent screen

**Solution:**
1. Go to APIs & Services > OAuth consent screen
2. Fill out all required fields:
   - App information (name, logo, support email)
   - App domain (homepage, privacy policy, ToS)
   - Authorized domains
3. Add test users if using "External" type during development
4. Submit for verification (required for production)
5. Wait 1-3 days for Google to review
6. Re-apply for API access after verification

### Issue 4: Application Rejected

**Problem:** Google denies your access request

**Common Reasons:**
- Use case violates GBP policies
- Insufficient business information
- OAuth consent screen incomplete
- Suspected spam or abuse
- No privacy policy or ToS

**Solution:**
1. Review rejection email carefully for specific reasons
2. Address each concern mentioned
3. Update OAuth consent screen if needed
4. Revise use case description to emphasize compliance
5. Add more detail about moderation and approval workflows
6. Reapply after 30 days (don't reapply immediately)

### Issue 5: Approved But Quota Still 0 QPM

**Problem:** Received approval email but quota unchanged

**Solution:**
1. Wait 24-48 hours for quota changes to propagate
2. Verify the GCP project ID in approval matches your project
3. Check if approval was for a different API (e.g., legacy GMB API)
4. Ensure you enabled the **current** Business Profile APIs (not legacy)
5. Contact Google Support via:
   - [Google Business Profile API Forum](https://support.google.com/business/community)
   - Your approval email (reply to ask for status)

### Issue 6: 403 Forbidden Errors When Creating Posts

**Problem:** API returns 403 even after quota shows 300 QPM

**Possible Causes:**

**A. Business Profile Not Verified**
- Solution: Verify location ownership in Google Business Profile Manager
- Go to business.google.com and complete verification

**B. Insufficient OAuth Scopes**
- Solution: Re-authenticate with scope:
  ```
  https://www.googleapis.com/auth/business.manage
  ```
- Delete existing connection and reconnect

**C. Location Doesn't Support Posts**
- Solution: Check location category (some categories don't allow posts)
- Service-area businesses may have restrictions

**D. Account Suspension**
- Solution: Check GBP Manager for account status
- Appeal suspension if necessary

### Issue 7: Can Read But Can't Write

**Problem:** Fetch requests work, but create/update requests fail

**Diagnosis:**
```bash
# Test read access
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  https://mybusinessbusinessinformation.googleapis.com/v1/accounts

# Test write access (will fail if read-only)
curl -X PATCH \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"languageCode": "en"}' \
  https://mybusinessbusinessinformation.googleapis.com/v1/locations/LOCATION_ID?updateMask=languageCode
```

**If write fails with 403:**
- Quota is 0 QPM (read-only access)
- Need to request full access via form

**If write fails with 400/404:**
- You have write access, but request is malformed
- Check API documentation for correct format

---

## Additional Resources

### Official Documentation
- [Google Business Profile API Overview](https://developers.google.com/my-business/content/overview)
- [API Reference Documentation](https://developers.google.com/my-business/reference/rest)
- [OAuth 2.0 Setup Guide](https://developers.google.com/identity/protocols/oauth2)
- [GBP Content Policies](https://support.google.com/business/answer/3038177)

### Community Support
- [Google Business Profile API Forum](https://support.google.com/business/community)
- [Stack Overflow - google-my-business-api tag](https://stackoverflow.com/questions/tagged/google-my-business-api)

### LocalSpotlight Documentation
- `SUPABASE_SETUP.md` - Database configuration for GBP data
- `QUICK_START.md` - Initial setup guide
- `.cursor/plans/local-928c70a6.plan.md` - Complete technical specification
- `apps/web/src/lib/google-oauth.ts` - OAuth implementation reference

### Google Cloud Console Quick Links
- [API Dashboard](https://console.cloud.google.com/apis/dashboard)
- [OAuth Consent Screen](https://console.cloud.google.com/apis/credentials/consent)
- [API Credentials](https://console.cloud.google.com/apis/credentials)
- [Quotas](https://console.cloud.google.com/iam-admin/quotas)

---

## Checklist: Before Requesting Access

Use this checklist to ensure you're ready to apply:

- [ ] Google Cloud Project created
- [ ] Billing enabled on GCP project
- [ ] All Business Profile APIs enabled
- [ ] OAuth consent screen configured and verified
- [ ] Privacy Policy URL publicly accessible
- [ ] Terms of Service URL publicly accessible
- [ ] Business website live and professional
- [ ] Use case clearly documented
- [ ] Compliance with GBP policies confirmed
- [ ] Rate limiting implemented in code
- [ ] Error handling and retry logic tested
- [ ] Current quota status checked (should show 0 QPM for writes)

---

## Next Steps After Getting Access

Once you have full API access (300+ QPM):

1. **Update Automation Policies**
   ```sql
   -- Enable auto_create mode for approved locations
   UPDATE automation_policies
   SET mode = 'auto_create'
   WHERE org_id = 'your-org-id'
     AND content_type = 'post';
   ```

2. **Test Publishing Pipeline**
   - Create test post candidate
   - Approve and schedule
   - Verify successful publish to GBP
   - Check location in GBP Manager to confirm post appears

3. **Configure Guardrails**
   - Set conservative `risk_threshold` (e.g., 0.3)
   - Set `max_per_week` caps (e.g., 7 posts)
   - Configure `quiet_hours` if needed
   - Test autopilot mode with low-risk location

4. **Monitor API Usage**
   - Track daily quota consumption
   - Set alerts at 70% and 90% of quota
   - Implement circuit breaker logic
   - Review error logs for 429 (rate limit) errors

5. **Enable Additional Features**
   - Review reply posting
   - Q&A answer publishing
   - Photo/video uploads
   - Full autopilot mode (after validation period)

---

## Questions?

If you encounter issues not covered in this guide:

1. Check the [official API documentation](https://developers.google.com/my-business/content/overview)
2. Search the [API community forum](https://support.google.com/business/community)
3. Review LocalSpotlight logs for specific error messages
4. Contact your development team with:
   - Screenshot of quota page
   - Error message from API response
   - Steps to reproduce the issue

---

**Document Version:** 1.0
**Last Updated:** 2025-10-19
**Maintainer:** LocalSpotlight Development Team
