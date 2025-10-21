import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/types/database";
import { createRouteHandlerClientWithAuth, getServiceRoleClient } from "@/lib/supabase-server";
import { decryptRefreshToken } from "@/lib/encryption";
import { fetchGooglePosts, extractAccountId, extractLocationId } from "@/lib/google-business";

type GbpPostInsert = Database["public"]["Tables"]["gbp_posts"]["Insert"];

export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClientWithAuth();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get request body
    const body = await request.json();
    const { orgId } = body;

    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId parameter" }, { status: 400 });
    }

    // Verify user has access to this organization
    const userId = user.id as Database["public"]["Tables"]["org_members"]["Row"]["user_id"];

    const serviceRole = getServiceRoleClient();
    const membership = await serviceRole
      .from("org_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!membership.data || (membership.data.role !== "owner" && membership.data.role !== "admin")) {
      return NextResponse.json({ error: "Access denied - owner/admin role required" }, { status: 403 });
    }

    // Fetch connections for this org
    const connections = await serviceRole
      .from("connections_google")
      .select("account_id, refresh_token_enc")
      .eq("org_id", orgId);

    if (connections.error || !connections.data?.length) {
      return NextResponse.json(
        { error: "No Google connections found for this organization" },
        { status: 404 }
      );
    }

    // Fetch managed locations for this org
    const locations = await serviceRole
      .from("gbp_locations")
      .select("id, google_location_name, account_id, title")
      .eq("org_id", orgId)
      .eq("is_managed", true);

    if (locations.error || !locations.data?.length) {
      return NextResponse.json(
        { error: "No managed locations found for this organization" },
        { status: 404 }
      );
    }

    // Build account_id -> refresh_token map
    const accountTokenMap = new Map<string, string>();
    for (const connection of connections.data) {
      if (!connection.account_id || !connection.refresh_token_enc) continue;

      try {
        const refreshToken = decryptRefreshToken(connection.refresh_token_enc);
        accountTokenMap.set(connection.account_id, refreshToken);
      } catch (error) {
        console.error("[syncPosts] Failed to decrypt refresh token for account", connection.account_id, error);
        continue;
      }
    }

    // Sync posts for each location
    const results = {
      totalLocations: locations.data.length,
      successfulLocations: 0,
      failedLocations: 0,
      totalPostsSynced: 0,
      newPosts: 0,
      updatedPosts: 0,
      errors: [] as string[],
    };

    for (const location of locations.data) {
      try {
        const accountId = extractAccountId(location.account_id || "");
        const locationId = extractLocationId(location.google_location_name);

        const refreshToken = accountTokenMap.get(location.account_id || "");
        if (!refreshToken) {
          results.errors.push(`No refresh token for location ${location.title || location.id}`);
          results.failedLocations++;
          continue;
        }

        console.log(`[syncPosts] Syncing posts for location: ${location.title || location.id} (${locationId})`);

        // Fetch posts from Google
        const googlePosts = await fetchGooglePosts(refreshToken, accountId, locationId);

        console.log(`[syncPosts] Fetched ${googlePosts.length} posts for location ${location.title}`);

        // Process each post
        for (const post of googlePosts) {
          if (!post.name) {
            console.warn("[syncPosts] Post missing name, skipping");
            continue;
          }

          // Parse event dates if present
          let eventStartDate: string | null = null;
          let eventEndDate: string | null = null;

          if (post.event?.schedule?.startDate) {
            const sd = post.event.schedule.startDate;
            if (sd.year && sd.month && sd.day) {
              eventStartDate = `${sd.year}-${String(sd.month).padStart(2, "0")}-${String(sd.day).padStart(2, "0")}`;
            }
          }

          if (post.event?.schedule?.endDate) {
            const ed = post.event.schedule.endDate;
            if (ed.year && ed.month && ed.day) {
              eventEndDate = `${ed.year}-${String(ed.month).padStart(2, "0")}-${String(ed.day).padStart(2, "0")}`;
            }
          }

          // Extract media URLs
          const mediaUrls = post.media
            ?.map((m) => m.sourceUrl)
            .filter((url): url is string => !!url) || null;

          const postInsert: GbpPostInsert = {
            org_id: orgId,
            location_id: location.id,
            google_post_name: post.name,
            summary: post.summary || null,
            topic_type: post.topicType || null,
            call_to_action_type: post.callToAction?.actionType || null,
            call_to_action_url: post.callToAction?.url || null,
            event_title: post.event?.title || null,
            event_start_date: eventStartDate,
            event_end_date: eventEndDate,
            offer_coupon_code: post.offer?.couponCode || null,
            offer_redeem_url: post.offer?.redeemOnlineUrl || null,
            offer_terms: post.offer?.termsConditions || null,
            media_urls: mediaUrls,
            state: post.state || null,
            search_url: post.searchUrl || null,
            meta: post as unknown as Database["public"]["Tables"]["gbp_posts"]["Insert"]["meta"],
            google_create_time: post.createTime || null,
            google_update_time: post.updateTime || null,
          };

          // Upsert post (insert or update based on unique constraint)
          const { error: upsertError } = await serviceRole
            .from("gbp_posts")
            .upsert(postInsert, {
              onConflict: "org_id,google_post_name",
              ignoreDuplicates: false,
            });

          if (upsertError) {
            console.error("[syncPosts] Error upserting post:", upsertError);
            results.errors.push(`Failed to upsert post ${post.name}: ${upsertError.message}`);
          } else {
            results.totalPostsSynced++;
            // Note: Supabase doesn't return info about whether it was insert vs update in upsert
            results.newPosts++;
          }
        }

        results.successfulLocations++;
      } catch (error) {
        console.error(`[syncPosts] Error syncing location ${location.title}:`, error);
        results.errors.push(`Location ${location.title}: ${error instanceof Error ? error.message : "Unknown error"}`);
        results.failedLocations++;
      }
    }

    console.log("[syncPosts] Sync complete:", results);

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("[syncPosts] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
