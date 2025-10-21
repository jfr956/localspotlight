import { NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase-server';
import { fetchGoogleReviews, parseStarRating } from '@/lib/google-business';
import { decryptRefreshToken } from '@/lib/encryption';
import type { Database } from '@/types/database';

type GbpLocation = Database['public']['Tables']['gbp_locations']['Row'];
type ConnectionGoogle = Database['public']['Tables']['connections_google']['Row'];

/**
 * Cron job to sync reviews for all organizations
 *
 * This endpoint should be called by Vercel Cron, Supabase Edge Functions with pg_cron,
 * or any external job scheduler.
 *
 * Security: Should be protected by:
 * 1. Vercel Cron Secret header verification
 * 2. Or internal service token
 * 3. Or IP allowlist
 *
 * Recommended schedule: Every 6 hours
 * Cron expression: 0 star-slash-6 star star star (replace star with asterisk)
 */
export async function GET() {
  console.log('[GET /api/cron/sync-reviews] Starting scheduled review sync...');

  // TODO: Add authentication check for cron jobs
  // Example: Check for CRON_SECRET header
  // const cronSecret = request.headers.get('authorization');
  // if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }

  try {
    const supabase = getServiceRoleClient();

    // Get all active Google connections across all orgs
    const { data: connections, error: connectionsError } = await supabase
      .from('connections_google')
      .select('*')
      .order('created_at', { ascending: true });

    if (connectionsError) {
      console.error('[GET /api/cron/sync-reviews] Error fetching connections:', connectionsError);
      return NextResponse.json({ error: 'Failed to fetch Google connections' }, { status: 500 });
    }

    if (!connections || connections.length === 0) {
      console.log('[GET /api/cron/sync-reviews] No Google connections found');
      return NextResponse.json({
        success: true,
        message: 'No Google connections found',
        stats: {
          orgsProcessed: 0,
          connectionsProcessed: 0,
          locationsProcessed: 0,
          newReviews: 0,
          errors: 0,
        },
      });
    }

    console.log(`[GET /api/cron/sync-reviews] Found ${connections.length} Google connection(s) across all orgs`);

    // Stats tracking
    const orgsProcessed = new Set<string>();
    let connectionsProcessed = 0;
    let locationsProcessed = 0;
    let newReviews = 0;
    let errorCount = 0;
    const errorDetails: Array<{ org_id: string; location: string; error: string }> = [];

    // Process each connection
    for (const connection of connections as ConnectionGoogle[]) {
      console.log(`[GET /api/cron/sync-reviews] Processing connection: ${connection.id} for org: ${connection.org_id}`);

      try {
        orgsProcessed.add(connection.org_id);

        // Decrypt refresh token
        const refreshToken = decryptRefreshToken(connection.refresh_token_enc);

        // Get all locations for this connection's account
        const { data: locations, error: locationsError } = await supabase
          .from('gbp_locations')
          .select('*')
          .eq('org_id', connection.org_id)
          .eq('account_id', connection.account_id);

        if (locationsError) {
          console.error(
            `[GET /api/cron/sync-reviews] Error fetching locations for connection ${connection.id}:`,
            locationsError
          );
          errorCount++;
          errorDetails.push({
            org_id: connection.org_id,
            location: `connection-${connection.id}`,
            error: locationsError.message,
          });
          continue;
        }

        if (!locations || locations.length === 0) {
          console.log(`[GET /api/cron/sync-reviews] No locations found for connection ${connection.id}`);
          continue;
        }

        console.log(`[GET /api/cron/sync-reviews] Found ${locations.length} location(s) for this connection`);

        // Process each location
        for (const location of locations as GbpLocation[]) {
          console.log(
            `[GET /api/cron/sync-reviews] Fetching reviews for location: ${location.title || location.id} (org: ${connection.org_id})`
          );

          try {
            // Extract account ID and location ID from google_location_name
            // Format: "accounts/123/locations/456"
            const locationNameParts = location.google_location_name.split('/');
            const accountId = locationNameParts[1];
            const locationId = locationNameParts[3];

            if (!accountId || !locationId) {
              console.error(
                `[GET /api/cron/sync-reviews] Invalid location name format: ${location.google_location_name}`
              );
              errorCount++;
              errorDetails.push({
                org_id: connection.org_id,
                location: location.title || location.id,
                error: 'Invalid location name format',
              });
              continue;
            }

            // Fetch reviews from Google API
            const reviews = await fetchGoogleReviews(refreshToken, accountId, locationId);

            console.log(`[GET /api/cron/sync-reviews] Fetched ${reviews.length} review(s) for ${location.title}`);

            // Upsert each review to database
            for (const review of reviews) {
              if (!review.reviewId) {
                console.warn('[GET /api/cron/sync-reviews] Skipping review without reviewId');
                continue;
              }

              const reviewData = {
                org_id: connection.org_id,
                location_id: location.id,
                review_id: review.reviewId,
                author: review.reviewer?.displayName || null,
                rating: parseStarRating(review.starRating),
                text: review.comment || null,
                reply: review.reviewReply?.comment || null,
                state: 'active',
                created_at: review.createTime || new Date().toISOString(),
                updated_at: review.updateTime || review.createTime || new Date().toISOString(),
              };

              // Try to insert, if conflict on review_id, update instead
              const { error: upsertError } = await supabase
                .from('gbp_reviews')
                .upsert(reviewData, {
                  onConflict: 'review_id',
                  ignoreDuplicates: false,
                });

              if (upsertError) {
                console.error(
                  `[GET /api/cron/sync-reviews] Error upserting review ${review.reviewId}:`,
                  upsertError
                );
                errorCount++;
                errorDetails.push({
                  org_id: connection.org_id,
                  location: location.title || location.id,
                  error: `Failed to upsert review: ${upsertError.message}`,
                });
              } else {
                newReviews++;
              }
            }

            locationsProcessed++;

            // Rate limiting: Add delay between locations to avoid hitting API quotas
            // Google allows 300 QPM (queries per minute)
            // With delay of 300ms, we can process ~200 locations per minute
            await new Promise((resolve) => setTimeout(resolve, 300));
          } catch (error) {
            console.error(
              `[GET /api/cron/sync-reviews] Error processing location ${location.title || location.id}:`,
              error
            );
            errorCount++;
            errorDetails.push({
              org_id: connection.org_id,
              location: location.title || location.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });

            // Continue to next location even if this one fails
            continue;
          }
        }

        connectionsProcessed++;

        // Add delay between connections to be extra safe with rate limits
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`[GET /api/cron/sync-reviews] Error processing connection ${connection.id}:`, error);
        errorCount++;
        errorDetails.push({
          org_id: connection.org_id,
          location: `connection-${connection.id}`,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        // Continue to next connection even if this one fails
        continue;
      }
    }

    // Return sync statistics
    const stats = {
      orgsProcessed: orgsProcessed.size,
      connectionsProcessed,
      locationsProcessed,
      newReviews,
      errors: errorCount,
    };

    console.log('[GET /api/cron/sync-reviews] Sync completed:', stats);

    // Log to audit_logs table for monitoring
    try {
      await supabase.from('audit_logs').insert({
        org_id: 'system', // System-level operation
        action: 'reviews_sync',
        resource_type: 'cron_job',
        resource_id: 'sync-reviews',
        metadata: {
          stats,
          errorCount: errorDetails.length,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (auditError) {
      console.error('[GET /api/cron/sync-reviews] Failed to log to audit_logs:', auditError);
      // Don't fail the whole operation if audit logging fails
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${newReviews} reviews from ${locationsProcessed} locations across ${orgsProcessed.size} organizations`,
      stats,
      errorDetails: errorDetails.length > 0 ? errorDetails.slice(0, 10) : undefined, // Limit error details to first 10
      totalErrors: errorDetails.length,
    });
  } catch (error) {
    console.error('[GET /api/cron/sync-reviews] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
