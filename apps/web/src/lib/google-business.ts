import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { getOAuthClient, GOOGLE_SCOPES } from "./google-oauth";

type Account = {
  name?: string | null;
  accountName?: string | null;
} & Record<string, unknown>;

type Location = {
  name?: string | null;
  title?: string | null;
  labels?: string[] | null;
  metadata?: { placeId?: string | null } | null;
} & Record<string, unknown>;

const getAccountsService = (auth: OAuth2Client) =>
  google.mybusinessaccountmanagement({ version: "v1", auth });

const getLocationsService = (auth: OAuth2Client) =>
  google.mybusinessbusinessinformation({ version: "v1", auth });

const getQandAService = (auth: OAuth2Client) =>
  google.mybusinessqanda({ version: "v1", auth });

export async function fetchGoogleAccounts(refreshToken: string): Promise<Account[]> {
  const oauthClient = getOAuthClient();
  oauthClient.setCredentials({ refresh_token: refreshToken });

  console.log('[fetchGoogleAccounts] OAuth client configured with project:', process.env.GOOGLE_CLIENT_ID?.split('-')[0]);
  console.log('[fetchGoogleAccounts] Attempting to fetch accounts from Google Business Profile API...');

  try {
    const service = getAccountsService(oauthClient);
    const response = await service.accounts.list({ pageSize: 100 });
    console.log('[fetchGoogleAccounts] Successfully fetched accounts:', response.data.accounts?.length ?? 0);
    return (response.data.accounts ?? []) as Account[];
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string; status?: number; config?: { url?: string } };
    console.error('[fetchGoogleAccounts] Error details:', {
      message: err.message,
      code: err.code,
      status: err.status,
      projectId: err.config?.url,
    });
    throw error;
  }
}

export async function fetchGoogleLocations(
  refreshToken: string,
  accountName: string,
): Promise<Location[]> {
  const oauthClient = getOAuthClient();
  oauthClient.setCredentials({ refresh_token: refreshToken });

  const service = getLocationsService(oauthClient);

  const locations: Location[] = [];
  let nextPageToken: string | undefined;

  do {
    const response = await service.accounts.locations.list({
      parent: accountName,
      readMask: "name,title,labels,metadata",
      pageSize: 50,
      pageToken: nextPageToken,
    });

      if (response.data.locations) {
        locations.push(...(response.data.locations as Location[]));
      }

    nextPageToken = response.data.nextPageToken ?? undefined;
  } while (nextPageToken);

  return locations;
}

export function extractLocationTitle(location: Location): string {
  return location.title ?? location.metadata?.placeId ?? location.name ?? "Unknown location";
}

export function extractLocationLabels(location: Location): string[] {
  return location.labels ?? [];
}

type Review = {
  reviewId?: string | null;
  reviewer?: {
    displayName?: string | null;
    profilePhotoUrl?: string | null;
  } | null;
  starRating?: string | null;
  comment?: string | null;
  createTime?: string | null;
  updateTime?: string | null;
  reviewReply?: {
    comment?: string | null;
    updateTime?: string | null;
  } | null;
} & Record<string, unknown>;

type Question = {
  name?: string | null;
  author?: {
    displayName?: string | null;
  } | null;
  text?: string | null;
  createTime?: string | null;
  upvoteCount?: number | null;
  topAnswers?: Array<{
    name?: string | null;
    author?: {
      displayName?: string | null;
    } | null;
    text?: string | null;
    createTime?: string | null;
    upvoteCount?: number | null;
  }> | null;
} & Record<string, unknown>;

/**
 * IMPORTANT: Google deprecated the Reviews API in 2024.
 * There is NO programmatic way to fetch reviews from Google Business Profile.
 *
 * This function is kept for backward compatibility but will always return an empty array
 * with a deprecation warning.
 *
 * Alternative approaches:
 * 1. Manual export from Google Business Profile dashboard
 * 2. Use third-party review aggregation services
 * 3. Scraping (violates ToS - not recommended)
 *
 * @deprecated Google removed programmatic access to reviews in 2024
 * @returns Always returns empty array
 */
export async function fetchGoogleReviews(
  refreshToken: string,
  locationName: string,
): Promise<Review[]> {
  console.log(`[fetchGoogleReviews] DEPRECATION WARNING: Google Business Profile Reviews API has been deprecated.`);
  console.log(`[fetchGoogleReviews] Location: ${locationName}`);
  console.log(`[fetchGoogleReviews] The v4 API endpoint (mybusiness.googleapis.com/v4/.../reviews) no longer exists.`);
  console.log(`[fetchGoogleReviews] Google has removed all programmatic access to reviews as of 2024.`);
  console.log(`[fetchGoogleReviews] Returning empty array. Please use alternative methods:`);
  console.log(`  1. Manual export from Business Profile dashboard`);
  console.log(`  2. Third-party review aggregation services`);
  console.log(`  3. Google Play Console API (for app reviews only)`);

  // Return empty array instead of making a failing API call
  return [];
}

/**
 * Fetch questions (Q&A) for a location using the Google My Business Q&A API v1.
 *
 * This API is still supported as of 2025 and will be available until at least November 3, 2025.
 *
 * API Documentation: https://developers.google.com/my-business/reference/rest/v1/locations.questions
 *
 * @param refreshToken - OAuth refresh token
 * @param locationName - Location resource name (e.g., "locations/12345")
 * @returns Array of questions with answers
 */
export async function fetchGoogleQuestions(
  refreshToken: string,
  locationName: string,
): Promise<Question[]> {
  console.log(`[fetchGoogleQuestions] Starting Q&A fetch for location: ${locationName}`);

  const oauthClient = getOAuthClient();
  oauthClient.setCredentials({ refresh_token: refreshToken });

  try {
    const service = getQandAService(oauthClient);
    const questions: Question[] = [];
    let pageToken: string | undefined;
    let pageCount = 0;

    do {
      pageCount++;

      console.log(`[fetchGoogleQuestions] Fetching page ${pageCount}...`);

      const response = await service.locations.questions.list({
        parent: locationName,
        pageSize: 100,
        pageToken: pageToken,
        orderBy: "updateTime desc",
      });

      console.log(`[fetchGoogleQuestions] Page ${pageCount} response:`, {
        questionsCount: response.data.questions?.length ?? 0,
        hasNextPageToken: !!response.data.nextPageToken,
      });

      if (response.data.questions) {
        questions.push(...(response.data.questions as Question[]));
      }

      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);

    console.log(`[fetchGoogleQuestions] ✓ Successfully fetched ${questions.length} questions for ${locationName} (${pageCount} pages)`);
    return questions;
  } catch (error: unknown) {
    const err = error as { message?: string; code?: number; response?: { data?: unknown } };
    console.error(`[fetchGoogleQuestions] Error fetching questions:`, {
      locationName,
      errorMessage: err.message,
      errorCode: err.code,
      responseData: err.response?.data,
    });

    // Return empty array if Q&A is not available for this location
    if (err.code === 404 || err.code === 403) {
      console.log(`[fetchGoogleQuestions] Q&A not available for ${locationName} - returning empty array`);
      return [];
    }

    // Don't throw, just return empty to allow other locations to continue
    console.log(`[fetchGoogleQuestions] Returning empty array to allow other operations to continue`);
    return [];
  }
}

type LocalPost = {
  name?: string | null;
  summary?: string | null;
  callToAction?: {
    actionType?: string | null;
    url?: string | null;
  } | null;
  media?: Array<{
    mediaFormat?: string | null;
    sourceUrl?: string | null;
    locationAssociation?: {
      category?: string | null;
    } | null;
  }> | null;
  topicType?: string | null;
  event?: {
    title?: string | null;
    schedule?: {
      startDate?: {
        year?: number;
        month?: number;
        day?: number;
      };
      endDate?: {
        year?: number;
        month?: number;
        day?: number;
      };
    } | null;
  } | null;
  offer?: {
    couponCode?: string | null;
    redeemOnlineUrl?: string | null;
    termsConditions?: string | null;
  } | null;
  createTime?: string | null;
  updateTime?: string | null;
  state?: string | null;
  searchUrl?: string | null;
} & Record<string, unknown>;

/**
 * IMPORTANT: Google deprecated the Local Posts API in 2024.
 * There is NO programmatic way to fetch or create posts via API.
 *
 * This function is kept for backward compatibility but will always return an empty array
 * with a deprecation warning.
 *
 * Alternative approaches:
 * 1. Manual posting through Google Business Profile dashboard
 * 2. Google Business Profile Manager app
 * 3. Wait for potential future API (no timeline announced)
 *
 * Creating posts programmatically:
 * - The only way is through the Business Profile dashboard
 * - Some third-party tools claim to support it but use unofficial methods
 * - Consider implementing a "Manual Assist" workflow where you prepare content
 *   and users paste it into the dashboard
 *
 * @deprecated Google removed programmatic access to posts in 2024
 * @returns Always returns empty array
 */
export async function fetchGooglePosts(
  refreshToken: string,
  locationName: string,
): Promise<LocalPost[]> {
  console.log(`[fetchGooglePosts] DEPRECATION WARNING: Google Business Profile Local Posts API has been deprecated.`);
  console.log(`[fetchGooglePosts] Location: ${locationName}`);
  console.log(`[fetchGooglePosts] The v4 API endpoint (mybusiness.googleapis.com/v4/.../localPosts) no longer exists.`);
  console.log(`[fetchGooglePosts] Google has removed all programmatic access to posts as of 2024.`);
  console.log(`[fetchGooglePosts] Returning empty array. Please use alternative methods:`);
  console.log(`  1. Manual posting via Business Profile dashboard`);
  console.log(`  2. Google Business Profile Manager mobile app`);
  console.log(`  3. Implement "Manual Assist" workflow (prepare content, user pastes into dashboard)`);

  // Return empty array instead of making a failing API call
  return [];
}

export { GOOGLE_SCOPES };
