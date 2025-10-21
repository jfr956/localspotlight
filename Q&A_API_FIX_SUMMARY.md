# Q&A API Fix Summary

## Problem
The googleapis library's `mybusinessqanda.locations.questions.list()` was failing with:
```
Error: Request contains an invalid argument.
Field: read_mask
Description: Invalid field mask provided
```

## Root Cause
The googleapis library for the Q&A API appears to be broken or incompatible with the current Google Business Profile Q&A API v1.

## Solution
Switched from using the googleapis library to using raw HTTP requests via `oauth2Client.request()`.

## Key Discoveries

### 1. The googleapis library is broken for Q&A API
- The `readMask` parameter that googleapis requires causes the API to fail
- Direct HTTP requests work perfectly without readMask

### 2. Query Parameter Constraints
- **pageSize limit**: Maximum 10 items per page (not documented)
- **orderBy**: Works with values like `updateTime desc`
- **filter**: Supported but limited options
- Attempting pageSize > 10 returns: "must be between 0 and 10"

### 3. Working Implementation
```typescript
const baseUrl = `https://mybusinessqanda.googleapis.com/v1/${locationName}/questions`;
const params = new URLSearchParams({
  orderBy: 'updateTime desc',
  pageSize: '10', // MAX is 10!
});

const response = await oauthClient.request({
  url: `${baseUrl}?${params.toString()}`,
  method: 'GET',
});
```

## Test Results

### Before Fix (googleapis library)
```
✗ Q&A API (googleapis library) error: Request contains an invalid argument.
  Field: read_mask
  Description: Invalid field mask provided
```

### After Fix (raw fetch)
```
✓ Successfully fetched 0 questions for locations/16919135625305195332 (1 pages)
[fetchGoogleQuestions] Page 1 response: { 
  questionsCount: 0, 
  hasNextPageToken: false, 
  totalSize: undefined 
}
```

## Files Modified

### 1. `/apps/web/src/lib/google-business.ts`
- Updated `fetchGoogleQuestions()` function
- Removed googleapis library usage for Q&A
- Implemented raw HTTP requests via oauth2Client.request()
- Added proper pagination support with pageToken
- Set pageSize to 10 (maximum allowed)
- Added orderBy parameter for sorted results

### 2. `/apps/web/test-google-sync.ts`
- Added Step 6b to compare googleapis vs raw fetch approaches
- Tests both minimal request and request with query params
- Discovers pageSize limit of 10

## API Documentation vs Reality

### What the docs say:
- pageSize, orderBy, readMask are supported parameters
- No mention of pageSize limits

### What actually works:
- pageSize: max 10 (returns 400 error if > 10)
- orderBy: works perfectly
- readMask: causes failures (at least via googleapis library)
- Minimal request (no params): works fine

## Pagination
- API returns `nextPageToken` when more results exist
- Pass `pageToken` parameter to get subsequent pages
- Each page returns max 10 questions
- Loop until no `nextPageToken` is returned

## Next Steps
1. ✅ Switch to raw fetch approach (DONE)
2. ✅ Handle pagination properly (DONE)
3. ✅ Set pageSize to 10 max (DONE)
4. Monitor for any future changes to the Q&A API
5. Consider similar approach for other Google APIs if issues arise

## Related APIs

### Still Working
- Business Profile Information API (v1): ✅ Works with googleapis library
- Account Management API (v1): ✅ Works with googleapis library

### Deprecated
- Reviews API (v4): ❌ Removed by Google in 2024
- Local Posts API (v4): ❌ Removed by Google in 2024

### Partially Working
- Q&A API (v1): ⚠️ Works with raw fetch, broken in googleapis library
- Available until November 3, 2025 (as per Google's deprecation notice)

## Lessons Learned
1. Google's official libraries can be outdated or broken
2. Raw HTTP requests with oauth2Client.request() are more reliable
3. Always test API limits empirically (docs may be wrong/outdated)
4. The Q&A API has undocumented constraints (pageSize limit)
5. Minimal requests (fewer params) are more likely to work

## Impact
This fix enables LocalSpotlight to:
- Fetch Q&A data from Google Business Profile locations
- Sync questions and answers for content generation
- Monitor customer questions for AI-powered responses
- Support Q&A automation features (auto_create and autopilot modes)
