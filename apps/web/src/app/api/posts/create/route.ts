import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/types/database";
import { createRouteHandlerClientWithAuth, getServiceRoleClient } from "@/lib/supabase-server";
import { decryptRefreshToken } from "@/lib/encryption";
import { createGooglePost, extractAccountId, extractLocationId } from "@/lib/google-business";
import type { CreatePostRequest } from "@/lib/google-business";

type ScheduleInsert = Database["public"]["Tables"]["schedules"]["Insert"];

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
    const { locationId, summary, topicType, callToAction, event, offer, media } = body;

    // Validate required fields
    if (!locationId || typeof locationId !== "string") {
      return NextResponse.json({ error: "locationId is required and must be a string" }, { status: 400 });
    }

    if (!summary || typeof summary !== "string") {
      return NextResponse.json({ error: "summary is required and must be a string" }, { status: 400 });
    }

    if (summary.length > 1500) {
      return NextResponse.json({ error: "summary must be 1500 characters or less" }, { status: 400 });
    }

    if (!topicType || !["STANDARD", "EVENT", "OFFER"].includes(topicType)) {
      return NextResponse.json({ error: "topicType must be STANDARD, EVENT, or OFFER" }, { status: 400 });
    }

    // Validate EVENT posts
    if (topicType === "EVENT") {
      if (!event?.title || !event?.schedule?.startDate) {
        return NextResponse.json(
          { error: "EVENT posts require event.title and event.schedule.startDate" },
          { status: 400 }
        );
      }
    }

    // Validate OFFER posts
    if (topicType === "OFFER") {
      if (!offer?.termsConditions) {
        return NextResponse.json(
          { error: "OFFER posts require offer.termsConditions" },
          { status: 400 }
        );
      }
    }

    // Get location details
    const serviceRole = getServiceRoleClient();
    const location = await serviceRole
      .from("gbp_locations")
      .select("id, org_id, google_location_name, account_id, title")
      .eq("id", locationId)
      .single();

    if (location.error || !location.data) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    const orgId = location.data.org_id;

    // Verify user has access to this organization
    const userId = user.id as Database["public"]["Tables"]["org_members"]["Row"]["user_id"];

    const membership = await serviceRole
      .from("org_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!membership.data || !["owner", "admin", "editor"].includes(membership.data.role)) {
      return NextResponse.json({ error: "Access denied - editor role required" }, { status: 403 });
    }

    // Get connection for this account
    const connection = await serviceRole
      .from("connections_google")
      .select("refresh_token_enc")
      .eq("account_id", location.data.account_id || "")
      .maybeSingle();

    if (!connection.data || !connection.data.refresh_token_enc) {
      return NextResponse.json(
        { error: "No Google connection found for this location's account" },
        { status: 404 }
      );
    }

    // Decrypt refresh token
    let refreshToken: string;
    try {
      refreshToken = decryptRefreshToken(connection.data.refresh_token_enc);
    } catch (error) {
      console.error("[createPost] Failed to decrypt refresh token:", error);
      return NextResponse.json({ error: "Failed to decrypt credentials" }, { status: 500 });
    }

    // Extract IDs
    const accountId = extractAccountId(location.data.account_id || "");
    const googleLocationId = extractLocationId(location.data.google_location_name);

    console.log("[createPost] Creating post for location:", {
      locationId,
      title: location.data.title,
      accountId,
      googleLocationId,
      topicType,
    });

    // Build post request
    const postRequest: CreatePostRequest = {
      languageCode: "en",
      summary,
      topicType: topicType as "STANDARD" | "EVENT" | "OFFER",
      callToAction,
      event,
      offer,
      media,
    };

    // Create post via Google API
    let createdPost;
    try {
      createdPost = await createGooglePost(refreshToken, accountId, googleLocationId, postRequest);
    } catch (error) {
      console.error("[createPost] Error creating post via Google API:", error);
      return NextResponse.json(
        {
          error: "Failed to create post",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }

    console.log("[createPost] Successfully created post:", createdPost.name);

    // Store post in gbp_posts table
    if (createdPost.name) {
      // Parse event dates if present
      let eventStartDate: string | null = null;
      let eventEndDate: string | null = null;

      if (createdPost.event?.schedule?.startDate) {
        const sd = createdPost.event.schedule.startDate;
        if (sd.year && sd.month && sd.day) {
          eventStartDate = `${sd.year}-${String(sd.month).padStart(2, "0")}-${String(sd.day).padStart(2, "0")}`;
        }
      }

      if (createdPost.event?.schedule?.endDate) {
        const ed = createdPost.event.schedule.endDate;
        if (ed.year && ed.month && ed.day) {
          eventEndDate = `${ed.year}-${String(ed.month).padStart(2, "0")}-${String(ed.day).padStart(2, "0")}`;
        }
      }

      // Extract media URLs
      const mediaUrls = createdPost.media
        ?.map((m) => m.sourceUrl)
        .filter((url): url is string => !!url) || null;

      const { error: insertError } = await serviceRole.from("gbp_posts").insert({
        org_id: orgId,
        location_id: locationId,
        google_post_name: createdPost.name,
        summary: createdPost.summary || null,
        topic_type: createdPost.topicType || null,
        call_to_action_type: createdPost.callToAction?.actionType || null,
        call_to_action_url: createdPost.callToAction?.url || null,
        event_title: createdPost.event?.title || null,
        event_start_date: eventStartDate,
        event_end_date: eventEndDate,
        offer_coupon_code: createdPost.offer?.couponCode || null,
        offer_redeem_url: createdPost.offer?.redeemOnlineUrl || null,
        offer_terms: createdPost.offer?.termsConditions || null,
        media_urls: mediaUrls,
        state: createdPost.state || null,
        search_url: createdPost.searchUrl || null,
        meta: createdPost as unknown as Database["public"]["Tables"]["gbp_posts"]["Insert"]["meta"],
        google_create_time: createdPost.createTime || null,
        google_update_time: createdPost.updateTime || null,
      });

      if (insertError) {
        console.error("[createPost] Error storing post in database:", insertError);
        // Don't fail the request since post was created successfully on Google
      }
    }

    // Store schedule entry
    const scheduleEntry: ScheduleInsert = {
      org_id: orgId,
      location_id: locationId,
      target_type: "gbp_post",
      target_id: createdPost.name || locationId, // Use post name as target_id
      publish_at: new Date().toISOString(),
      status: "published",
      provider_ref: createdPost.name || null,
    };

    const { error: scheduleError } = await serviceRole.from("schedules").insert(scheduleEntry);

    if (scheduleError) {
      console.error("[createPost] Error creating schedule entry:", scheduleError);
      // Don't fail the request since post was created successfully
    }

    return NextResponse.json({
      success: true,
      post: {
        name: createdPost.name,
        summary: createdPost.summary,
        topicType: createdPost.topicType,
        state: createdPost.state,
        searchUrl: createdPost.searchUrl,
        createTime: createdPost.createTime,
      },
      message: "Post successfully created and published to Google Business Profile",
    });
  } catch (error) {
    console.error("[createPost] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
