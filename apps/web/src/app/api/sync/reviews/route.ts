import { NextResponse } from 'next/server';
import { createRouteHandlerClientWithAuth, getServiceRoleClient } from '@/lib/supabase-server';
import { fetchGoogleReviews, parseStarRating, extractLocationId } from '@/lib/google-business';
import { decryptRefreshToken } from '@/lib/encryption';
import type { Database } from '@/types/database';

type GbpLocation = Database['public']['Tables']['gbp_locations']['Row'];
type ConnectionGoogle = Database['public']['Tables']['connections_google']['Row'];

export async function POST() {
  console.log('[POST /api/sync/reviews] Starting manual review sync...');

  try {
    const supabase = await createRouteHandlerClientWithAuth();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('[POST /api/sync/reviews] Unauthorized:', userError?.message);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's org_id from org_members
    const { data: orgMember, error: orgError } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .single();

    if (orgError || !orgMember) {
      console.error('[POST /api/sync/reviews] User not a member of any org:', orgError?.message);
      return NextResponse.json({ error: 'User not a member of any organization' }, { status: 403 });
    }

    const orgId = orgMember.org_id;
    console.log(`[POST /api/sync/reviews] Syncing reviews for org: ${orgId}`);

    // Use service role client for better performance and to bypass RLS checks
    const serviceRole = getServiceRoleClient();

    // Get all Google connections for this org
    const { data: connections, error: connectionsError } = await serviceRole
      .from('connections_google')
      .select('*')
      .eq('org_id', orgId);

    if (connectionsError) {
      console.error('[POST /api/sync/reviews] Error fetching connections:', connectionsError);
      return NextResponse.json({ error: 'Failed to fetch Google connections' }, { status: 500 });
    }

    if (!connections || connections.length === 0) {
      console.log('[POST /api/sync/reviews] No Google connections found');
      return NextResponse.json({
        success: true,
        message: 'No Google connections found',
        stats: {
          connectionsProcessed: 0,
          locationsProcessed: 0,
          newReviews: 0,
          updatedReviews: 0,
          totalReviews: 0,
          errors: 0,
        },
      });
    }

    console.log(`[POST /api/sync/reviews] Found ${connections.length} Google connection(s)`);

    // Stats tracking
    let connectionsProcessed = 0;
    let locationsProcessed = 0;
    let newReviews = 0;
    let updatedReviews = 0;
    let errorCount = 0;
    const errorDetails: Array<{ location: string; error: string }> = [];

    // Process each connection
    for (const connection of connections as ConnectionGoogle[]) {
      console.log(`[POST /api/sync/reviews] Processing connection: ${connection.id}`);

      try {
        // Decrypt refresh token
        const refreshToken = decryptRefreshToken(connection.refresh_token_enc);

        // Get all managed locations for this org (not filtered by account_id since that's unreliable)
        // We'll use the connection's account_id from the google_location_name instead
        const { data: locations, error: locationsError } = await serviceRole
          .from('gbp_locations')
          .select('*')
          .eq('org_id', orgId)
          .eq('is_managed', true);

        if (locationsError) {
          console.error(
            `[POST /api/sync/reviews] Error fetching locations for connection ${connection.id}:`,
            locationsError
          );
          errorCount++;
          errorDetails.push({
            location: `connection-${connection.id}`,
            error: locationsError.message,
          });
          continue;
        }

        if (!locations || locations.length === 0) {
          console.log(`[POST /api/sync/reviews] No managed locations found for this org`);
          continue;
        }

        console.log(`[POST /api/sync/reviews] Found ${locations.length} managed location(s) for this org`);

        // Process each location
        for (const location of locations as GbpLocation[]) {
          console.log(`[POST /api/sync/reviews] Fetching reviews for location: ${location.title || location.id}`);

          try {
            // Extract location ID from google_location_name
            // Format could be "locations/123" or "accounts/123/locations/456"
            const locationId = extractLocationId(location.google_location_name);

            // Extract account ID - use connection.account_id which should be the Google account name
            // Remove "accounts/" prefix if present
            const accountId = connection.account_id.replace(/^accounts\//, '');

            if (!accountId || !locationId) {
              console.error(
                `[POST /api/sync/reviews] Invalid account/location IDs - account: ${accountId}, location: ${locationId}`
              );
              errorCount++;
              errorDetails.push({
                location: location.title || location.id,
                error: 'Invalid account or location ID',
              });
              continue;
            }

            console.log(`[POST /api/sync/reviews] Using accountId: ${accountId}, locationId: ${locationId}`);

            // Fetch reviews from Google API
            const reviews = await fetchGoogleReviews(refreshToken, accountId, locationId);

            console.log(`[POST /api/sync/reviews] Fetched ${reviews.length} review(s) for ${location.title}`);

            // Upsert each review to database
            for (const review of reviews) {
              if (!review.reviewId) {
                console.warn('[POST /api/sync/reviews] Skipping review without reviewId');
                continue;
              }

              // Check if review already exists to track new vs updated
              const { data: existingReview } = await serviceRole
                .from('gbp_reviews')
                .select('id')
                .eq('review_id', review.reviewId)
                .maybeSingle();

              const isUpdate = !!existingReview;

              const reviewData = {
                org_id: orgId,
                location_id: location.id,
                review_id: review.reviewId,
                author: review.reviewer?.displayName || null,
                rating: parseStarRating(review.starRating),
                text: review.comment || null,
                reply: review.reviewReply?.comment || null,
                state: 'active', // Can be enhanced with more states
                created_at: review.createTime || new Date().toISOString(),
                updated_at: review.updateTime || review.createTime || new Date().toISOString(),
              };

              // Upsert review (insert or update based on review_id)
              const { error: upsertError } = await serviceRole
                .from('gbp_reviews')
                .upsert(reviewData, {
                  onConflict: 'review_id',
                  ignoreDuplicates: false, // Update if exists
                });

              if (upsertError) {
                console.error(`[POST /api/sync/reviews] Error upserting review ${review.reviewId}:`, upsertError);
                errorCount++;
                errorDetails.push({
                  location: location.title || location.id,
                  error: `Failed to upsert review: ${upsertError.message}`,
                });
              } else {
                if (isUpdate) {
                  updatedReviews++;
                } else {
                  newReviews++;
                }
              }
            }

            locationsProcessed++;

            // Rate limiting: Add delay between locations to avoid hitting API quotas
            // Google allows 300 QPM, so 150ms delay = max 400 requests/minute (safe margin)
            await new Promise((resolve) => setTimeout(resolve, 150));
          } catch (error) {
            console.error(
              `[POST /api/sync/reviews] Error processing location ${location.title || location.id}:`,
              error
            );
            errorCount++;
            errorDetails.push({
              location: location.title || location.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
            // Continue with next location despite error
          }
        }

        connectionsProcessed++;
      } catch (error) {
        console.error(`[POST /api/sync/reviews] Error processing connection ${connection.id}:`, error);
        errorCount++;
        errorDetails.push({
          location: `connection-${connection.id}`,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Return sync statistics
    const stats = {
      connectionsProcessed,
      locationsProcessed,
      newReviews,
      updatedReviews,
      totalReviews: newReviews + updatedReviews,
      errors: errorCount,
    };

    console.log('[POST /api/sync/reviews] Sync completed:', stats);

    return NextResponse.json({
      success: true,
      message: `Synced ${stats.totalReviews} reviews (${newReviews} new, ${updatedReviews} updated) from ${locationsProcessed} locations`,
      stats,
      errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
    });
  } catch (error) {
    console.error('[POST /api/sync/reviews] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
