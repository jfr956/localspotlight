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
 * Fetch reviews for a location using the Google My Business API v4.
 *
 * IMPORTANT: Despite earlier reports of deprecation, the v4 Reviews API is still functional
 * as of January 2025. This uses the mybusiness.googleapis.com/v4 endpoint.
 *
 * API Documentation: https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/list
 *
 * @param refreshToken - OAuth refresh token
 * @param accountId - Account ID (just the numeric portion, e.g., "108283827725802632530")
 * @param locationId - Location ID (just the numeric portion, e.g., "16919135625305195332")
 * @returns Array of reviews with ratings, comments, and replies
 */
export async function fetchGoogleReviews(
  refreshToken: string,
  accountId: string,
  locationId: string,
): Promise<Review[]> {
  console.log(`[fetchGoogleReviews] Starting review fetch for account: ${accountId}, location: ${locationId}`);

  const oauthClient = getOAuthClient();
  oauthClient.setCredentials({ refresh_token: refreshToken });

  try {
    const reviews: Review[] = [];
    let pageToken: string | undefined;
    let pageCount = 0;

    do {
      pageCount++;
      console.log(`[fetchGoogleReviews] Fetching page ${pageCount} of reviews...`);

      // Build URL with query parameters
      const baseUrl = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews`;
      const params = new URLSearchParams();

      if (pageToken) {
        params.append('pageToken', pageToken);
      }

      // Optional: add pageSize (default seems to be 50)
      params.append('pageSize', '50');

      const url = params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;

      console.log(`[fetchGoogleReviews] Request URL: ${url}`);

      // Use oauth2Client.request() for raw HTTP access with proper auth handling
      const response = await oauthClient.request<{
        reviews?: Review[];
        averageRating?: number;
        totalReviewCount?: number;
        nextPageToken?: string;
      }>({
        url,
        method: 'GET',
      });

      console.log(`[fetchGoogleReviews] Page ${pageCount} response:`, {
        reviewsCount: response.data.reviews?.length ?? 0,
        averageRating: response.data.averageRating,
        totalReviewCount: response.data.totalReviewCount,
        hasNextPageToken: !!response.data.nextPageToken,
      });

      if (response.data.reviews) {
        reviews.push(...response.data.reviews);
      }

      if (pageCount === 1 && response.data.reviews && response.data.reviews.length > 0) {
        const firstReview = response.data.reviews[0];
        console.log(`[fetchGoogleReviews] Sample review:`, {
          reviewId: firstReview.reviewId,
          starRating: firstReview.starRating,
          hasComment: !!firstReview.comment,
          hasReply: !!firstReview.reviewReply,
        });
      }

      pageToken = response.data.nextPageToken;
    } while (pageToken);

    console.log(`[fetchGoogleReviews] ✓ Successfully fetched ${reviews.length} reviews (${pageCount} pages)`);
    return reviews;
  } catch (error: unknown) {
    const err = error as {
      message?: string;
      code?: number;
      response?: {
        data?: unknown;
        status?: number;
        statusText?: string;
      }
    };
    console.error(`[fetchGoogleReviews] Error fetching reviews:`, {
      accountId,
      locationId,
      errorMessage: err.message,
      errorCode: err.code,
      responseStatus: err.response?.status,
      responseStatusText: err.response?.statusText,
      responseData: err.response?.data,
    });

    // Return empty array if reviews are not available for this location
    if (err.code === 404 || err.code === 403 || err.response?.status === 404 || err.response?.status === 403) {
      console.log(`[fetchGoogleReviews] Reviews not available for location ${locationId} - returning empty array`);
      return [];
    }

    // Don't throw, just return empty to allow other locations to continue
    console.log(`[fetchGoogleReviews] Returning empty array to allow other operations to continue`);
    return [];
  }
}

/**
 * Helper function to convert star rating string to number
 * Google returns: "ONE", "TWO", "THREE", "FOUR", "FIVE"
 * We need: 1, 2, 3, 4, 5
 */
export function parseStarRating(starRating: string | null | undefined): number | null {
  if (!starRating) return null;

  const ratingMap: Record<string, number> = {
    'ONE': 1,
    'TWO': 2,
    'THREE': 3,
    'FOUR': 4,
    'FIVE': 5,
  };

  return ratingMap[starRating] ?? null;
}

/**
 * Fetch questions (Q&A) for a location using raw fetch via oauth2Client.request().
 *
 * This API is still supported as of 2025 and will be available until at least November 3, 2025.
 *
 * API Documentation: https://developers.google.com/my-business/reference/rest/v1/locations.questions/list
 *
 * IMPORTANT DISCOVERIES:
 * - The googleapis library's mybusinessqanda.locations.questions.list() is BROKEN
 * - Using raw oauth2Client.request() works perfectly without readMask
 * - API supports basic pagination with pageToken
 * - pageSize limit: max 10 (not documented, discovered through testing)
 * - Query params like filter, orderBy work with pageSize <=10
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
    const questions: Question[] = [];
    let pageToken: string | undefined;
    let pageCount = 0;

    do {
      pageCount++;
      console.log(`[fetchGoogleQuestions] Fetching page ${pageCount}...`);

      // Build URL with query parameters
      const baseUrl = `https://mybusinessqanda.googleapis.com/v1/${locationName}/questions`;
      const params = new URLSearchParams();

      // Add optional sorting and filtering
      // Note: pageSize max is 10 (discovered through testing)
      params.append('orderBy', 'updateTime desc');
      params.append('pageSize', '10');

      if (pageToken) {
        params.append('pageToken', pageToken);
      }

      const url = `${baseUrl}?${params.toString()}`;

      console.log(`[fetchGoogleQuestions] Request URL: ${url}`);

      // Use oauth2Client.request() for raw HTTP access with proper auth handling
      const response = await oauthClient.request<{
        questions?: Question[];
        nextPageToken?: string;
        totalSize?: number;
      }>({
        url,
        method: 'GET',
      });

      console.log(`[fetchGoogleQuestions] Page ${pageCount} response:`, {
        questionsCount: response.data.questions?.length ?? 0,
        hasNextPageToken: !!response.data.nextPageToken,
        totalSize: response.data.totalSize,
      });

      if (response.data.questions) {
        questions.push(...response.data.questions);
      }

      pageToken = response.data.nextPageToken;
    } while (pageToken);

    console.log(`[fetchGoogleQuestions] ✓ Successfully fetched ${questions.length} questions for ${locationName} (${pageCount} pages)`);
    return questions;
  } catch (error: unknown) {
    const err = error as {
      message?: string;
      code?: number;
      response?: {
        data?: unknown;
        status?: number;
        statusText?: string;
      }
    };
    console.error(`[fetchGoogleQuestions] Error fetching questions:`, {
      locationName,
      errorMessage: err.message,
      errorCode: err.code,
      responseStatus: err.response?.status,
      responseStatusText: err.response?.statusText,
      responseData: err.response?.data,
    });

    // Return empty array if Q&A is not available for this location
    if (err.code === 404 || err.code === 403 || err.response?.status === 404 || err.response?.status === 403) {
      console.log(`[fetchGoogleQuestions] Q&A not available for ${locationName} - returning empty array`);
      return [];
    }

    // Don't throw, just return empty to allow other locations to continue
    console.log(`[fetchGoogleQuestions] Returning empty array to allow other operations to continue`);
    return [];
  }
}

export type LocalPost = {
  name?: string | null;
  languageCode?: string | null;
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

export type CreatePostRequest = {
  languageCode: string;
  summary: string;
  topicType: 'STANDARD' | 'EVENT' | 'OFFER';
  callToAction?: {
    actionType: 'LEARN_MORE' | 'CALL' | 'BOOK' | 'ORDER' | 'SIGN_UP' | 'SHOP';
    url?: string;
  };
  event?: {
    title: string;
    schedule: {
      startDate: { year: number; month: number; day: number };
      endDate?: { year: number; month: number; day: number };
    };
  };
  offer?: {
    couponCode?: string;
    redeemOnlineUrl?: string;
    termsConditions?: string;
  };
  media?: Array<{
    mediaFormat: string;
    sourceUrl: string;
  }>;
};

/**
 * Fetch posts (Local Posts) for a location using raw fetch via oauth2Client.request().
 *
 * IMPORTANT: Despite Google's general deprecation notices, the v4 Posts API is still working
 * for accounts with legacy access or specific configurations. This implementation uses the
 * mybusiness.googleapis.com/v4 endpoint which has been confirmed to work with the enabled API.
 *
 * API Documentation: https://developers.google.com/my-business/reference/rest/v4.1/accounts.locations.localPosts/list
 *
 * @param refreshToken - OAuth refresh token
 * @param accountId - Account ID (numeric string, e.g., "108283827725802632530")
 * @param locationId - Location ID (numeric string, e.g., "16919135625305195332")
 * @returns Array of posts from the location
 */
export async function fetchGooglePosts(
  refreshToken: string,
  accountId: string,
  locationId: string,
): Promise<LocalPost[]> {
  console.log(`[fetchGooglePosts] Starting posts fetch for account: ${accountId}, location: ${locationId}`);

  const oauthClient = getOAuthClient();
  oauthClient.setCredentials({ refresh_token: refreshToken });

  try {
    const posts: LocalPost[] = [];
    let pageToken: string | undefined;
    let pageCount = 0;

    do {
      pageCount++;
      console.log(`[fetchGooglePosts] Fetching page ${pageCount}...`);

      // Build URL with query parameters
      const baseUrl = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/localPosts`;
      const params = new URLSearchParams();

      if (pageToken) {
        params.append('pageToken', pageToken);
      }

      // Optional: add pageSize (max seems to be around 100)
      params.append('pageSize', '100');

      const url = params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;

      console.log(`[fetchGooglePosts] Request URL: ${url}`);

      // Use oauth2Client.request() for raw HTTP access with proper auth handling
      const response = await oauthClient.request<{
        localPosts?: LocalPost[];
        nextPageToken?: string;
      }>({
        url,
        method: 'GET',
      });

      console.log(`[fetchGooglePosts] Page ${pageCount} response:`, {
        postsCount: response.data.localPosts?.length ?? 0,
        hasNextPageToken: !!response.data.nextPageToken,
      });

      if (response.data.localPosts) {
        posts.push(...response.data.localPosts);
      }

      pageToken = response.data.nextPageToken;
    } while (pageToken);

    console.log(`[fetchGooglePosts] ✓ Successfully fetched ${posts.length} posts for location ${locationId} (${pageCount} pages)`);
    return posts;
  } catch (error: unknown) {
    const err = error as {
      message?: string;
      code?: number;
      response?: {
        data?: unknown;
        status?: number;
        statusText?: string;
      }
    };
    console.error(`[fetchGooglePosts] Error fetching posts:`, {
      accountId,
      locationId,
      errorMessage: err.message,
      errorCode: err.code,
      responseStatus: err.response?.status,
      responseStatusText: err.response?.statusText,
      responseData: err.response?.data,
    });

    // Return empty array if Posts API is not available for this location
    if (err.code === 404 || err.code === 403 || err.response?.status === 404 || err.response?.status === 403) {
      console.log(`[fetchGooglePosts] Posts API not available for location ${locationId} - returning empty array`);
      return [];
    }

    // Don't throw, just return empty to allow other locations to continue
    console.log(`[fetchGooglePosts] Returning empty array to allow other operations to continue`);
    return [];
  }
}

/**
 * Create a new post for a location using the Google Business Profile API.
 *
 * IMPORTANT: Post creation requires specific permissions and may not work for all accounts.
 * The API has strict validation rules:
 * - summary: max 1500 characters
 * - EVENT posts: require title and start date
 * - OFFER posts: require terms and conditions
 * - All posts: must comply with GBP content policies
 *
 * Rate limits: 300 QPM (Queries Per Minute)
 *
 * @param refreshToken - OAuth refresh token
 * @param accountId - Account ID (numeric string)
 * @param locationId - Location ID (numeric string)
 * @param postData - Post content and metadata
 * @returns Created post data
 */
export async function createGooglePost(
  refreshToken: string,
  accountId: string,
  locationId: string,
  postData: CreatePostRequest,
): Promise<LocalPost> {
  console.log(`[createGooglePost] Creating post for account: ${accountId}, location: ${locationId}`);
  console.log(`[createGooglePost] Post type: ${postData.topicType}`);

  const oauthClient = getOAuthClient();
  oauthClient.setCredentials({ refresh_token: refreshToken });

  // Validate post content
  if (!postData.summary || postData.summary.length > 1500) {
    throw new Error('Post summary is required and must be 1500 characters or less');
  }

  if (postData.topicType === 'EVENT') {
    if (!postData.event?.title || !postData.event?.schedule?.startDate) {
      throw new Error('EVENT posts require title and start date');
    }
  }

  if (postData.topicType === 'OFFER') {
    if (!postData.offer?.termsConditions) {
      throw new Error('OFFER posts require terms and conditions');
    }
  }

  try {
    const url = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/localPosts`;

    console.log(`[createGooglePost] POST URL: ${url}`);
    console.log(`[createGooglePost] Request body:`, JSON.stringify(postData, null, 2));

    const response = await oauthClient.request<LocalPost>({
      url,
      method: 'POST',
      data: postData,
    });

    console.log(`[createGooglePost] ✓ Successfully created post:`, {
      name: response.data.name,
      topicType: response.data.topicType,
      state: response.data.state,
    });

    return response.data;
  } catch (error: unknown) {
    const err = error as {
      message?: string;
      code?: number;
      response?: {
        data?: unknown;
        status?: number;
        statusText?: string;
      }
    };
    console.error(`[createGooglePost] Error creating post:`, {
      accountId,
      locationId,
      errorMessage: err.message,
      errorCode: err.code,
      responseStatus: err.response?.status,
      responseStatusText: err.response?.statusText,
      responseData: err.response?.data,
    });

    throw new Error(`Failed to create post: ${err.message || 'Unknown error'}`);
  }
}

/**
 * Extract account ID from Google account name.
 * Example: "accounts/12345" -> "12345"
 */
export function extractAccountId(accountName: string): string {
  return accountName.split('/').pop() || accountName;
}

/**
 * Extract location ID from Google location name.
 * Example: "locations/67890" -> "67890"
 */
export function extractLocationId(locationName: string): string {
  return locationName.split('/').pop() || locationName;
}

export { GOOGLE_SCOPES };
