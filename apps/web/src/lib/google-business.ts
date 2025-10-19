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

export async function fetchGoogleReviews(
  refreshToken: string,
  locationName: string,
): Promise<Review[]> {
  const oauthClient = getOAuthClient();
  oauthClient.setCredentials({ refresh_token: refreshToken });

  try {
    // Get access token
    const { token } = await oauthClient.getAccessToken();
    if (!token) {
      throw new Error("Failed to get access token");
    }

    const reviews: Review[] = [];
    let pageToken: string | undefined;

    do {
      // Use Google My Business API v4.9 for reviews
      const url = new URL(`https://mybusiness.googleapis.com/v4/${locationName}/reviews`);
      if (pageToken) {
        url.searchParams.set("pageToken", pageToken);
      }
      url.searchParams.set("pageSize", "50");

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 404 || response.status === 403) {
          console.log(`[fetchGoogleReviews] Reviews not available for ${locationName} (${response.status})`);
          return [];
        }
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json() as { reviews?: Review[]; nextPageToken?: string };

      if (data.reviews) {
        reviews.push(...data.reviews);
      }

      pageToken = data.nextPageToken;
    } while (pageToken);

    console.log(`[fetchGoogleReviews] Fetched ${reviews.length} reviews for ${locationName}`);
    return reviews;
  } catch (error: unknown) {
    const err = error as { message?: string; code?: number };
    console.error(`[fetchGoogleReviews] Error fetching reviews for ${locationName}:`, err.message);
    // Return empty array if reviews API fails (some locations may not have reviews enabled)
    if (err.code === 404 || err.code === 403) {
      return [];
    }
    // Don't throw, just return empty to allow other locations to continue
    return [];
  }
}

export async function fetchGoogleQuestions(
  refreshToken: string,
  locationName: string,
): Promise<Question[]> {
  const oauthClient = getOAuthClient();
  oauthClient.setCredentials({ refresh_token: refreshToken });

  try {
    // Get access token
    const { token } = await oauthClient.getAccessToken();
    if (!token) {
      throw new Error("Failed to get access token");
    }

    const questions: Question[] = [];
    let pageToken: string | undefined;

    do {
      // Use Google My Business Q&A API v1
      const url = new URL(`https://mybusinessqanda.googleapis.com/v1/${locationName}/questions`);
      if (pageToken) {
        url.searchParams.set("pageToken", pageToken);
      }
      url.searchParams.set("pageSize", "50");
      // Order by update time to get most recent first
      url.searchParams.set("orderBy", "updateTime desc");

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 404 || response.status === 403) {
          console.log(`[fetchGoogleQuestions] Q&A not available for ${locationName} (${response.status})`);
          return [];
        }
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json() as { questions?: Question[]; nextPageToken?: string };

      if (data.questions) {
        questions.push(...data.questions);
      }

      pageToken = data.nextPageToken;
    } while (pageToken);

    console.log(`[fetchGoogleQuestions] Fetched ${questions.length} questions for ${locationName}`);
    return questions;
  } catch (error: unknown) {
    const err = error as { message?: string; code?: number };
    console.error(`[fetchGoogleQuestions] Error fetching Q&A for ${locationName}:`, err.message);
    // Return empty array if Q&A API fails (some locations may not have Q&A enabled)
    if (err.code === 404 || err.code === 403) {
      return [];
    }
    // Don't throw, just return empty to allow other locations to continue
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

export async function fetchGooglePosts(
  refreshToken: string,
  locationName: string,
): Promise<LocalPost[]> {
  const oauthClient = getOAuthClient();
  oauthClient.setCredentials({ refresh_token: refreshToken });

  try {
    // Get access token
    const { token } = await oauthClient.getAccessToken();
    if (!token) {
      throw new Error("Failed to get access token");
    }

    const posts: LocalPost[] = [];
    let pageToken: string | undefined;

    do {
      // Use Google My Business API v4 for local posts
      const url = new URL(`https://mybusiness.googleapis.com/v4/${locationName}/localPosts`);
      if (pageToken) {
        url.searchParams.set("pageToken", pageToken);
      }
      url.searchParams.set("pageSize", "100");

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 404 || response.status === 403) {
          console.log(`[fetchGooglePosts] Posts not available for ${locationName} (${response.status})`);
          return [];
        }
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json() as { localPosts?: LocalPost[]; nextPageToken?: string };

      if (data.localPosts) {
        posts.push(...data.localPosts);
      }

      pageToken = data.nextPageToken;
    } while (pageToken);

    console.log(`[fetchGooglePosts] Fetched ${posts.length} posts for ${locationName}`);
    return posts;
  } catch (error: unknown) {
    const err = error as { message?: string; code?: number };
    console.error(`[fetchGooglePosts] Error fetching posts for ${locationName}:`, err.message);
    // Return empty array if posts API fails (some accounts may not have posts API access)
    if (err.code === 404 || err.code === 403) {
      return [];
    }
    // Don't throw, just return empty to allow other locations to continue
    return [];
  }
}

export { GOOGLE_SCOPES };
