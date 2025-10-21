import { NextRequest, NextResponse } from "next/server";
import { createServerActionClientWithAuth } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerActionClientWithAuth();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get("scheduleId");

    if (!scheduleId) {
      return NextResponse.json({ error: "scheduleId is required" }, { status: 400 });
    }

    // Get the schedule details
    const { data: schedule, error: scheduleError } = await supabase
      .from("schedules")
      .select(`
        *,
        post_candidates!inner(
          *,
          gbp_locations!inner(
            *,
            orgs!inner(*)
          )
        )
      `)
      .eq("id", scheduleId)
      .single();

    if (scheduleError || !schedule) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    // Extract the organization ID from the nested data
    const orgId = (schedule as any).post_candidates?.gbp_locations?.orgs?.id;
    if (!orgId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    if (scheduleError || !schedule) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    // Check if user has permission to publish for this organization
    const { data: membership } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .single();

    const allowedRoles = ["owner", "admin", "editor"];
    if (!membership || !allowedRoles.includes(membership.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Call the Edge Function to publish the post
    const edgeFunctionUrl = `${process.env.SUPABASE_URL}/functions/v1/publish-posts`;
    const response = await fetch(edgeFunctionUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.PUBLISH_POSTS_CRON_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        manualTrigger: true,
        scheduleId,
        userId: user.id,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: "Failed to publish post", details: error },
        { status: 500 }
      );
    }

    const result = await response.json();

    // Revalidate the location page to show updated status
    revalidatePath(`/locations/${schedule.location_id}`);
    revalidatePath("/content");

    return NextResponse.json({
      success: true,
      message: "Post publishing triggered",
      result,
    });
  } catch (error) {
    console.error("[API] Error publishing post:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerActionClientWithAuth();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get("locationId");

    if (!locationId) {
      return NextResponse.json({ error: "locationId is required" }, { status: 400 });
    }

    // Get schedules with their post candidates for the location
    const { data: schedules, error } = await supabase
      .from("schedules")
      .select(`
        *,
        post_candidates!inner(
          id,
          schema,
          status as candidate_status,
          created_at
        )
      `)
      .eq("location_id", locationId)
      .eq("target_type", "post_candidate")
      .order("publish_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[API] Error fetching schedules:", error);
      return NextResponse.json({ error: "Failed to fetch schedules" }, { status: 500 });
    }

    // Get published posts from gbp_posts table
    const { data: publishedPosts, error: publishedError } = await supabase
      .from("gbp_posts")
      .select("*")
      .eq("location_id", locationId)
      .order("google_create_time", { ascending: false })
      .limit(50);

    if (publishedError) {
      console.error("[API] Error fetching published posts:", publishedError);
      return NextResponse.json({ error: "Failed to fetch published posts" }, { status: 500 });
    }

    return NextResponse.json({
      schedules: schedules || [],
      publishedPosts: publishedPosts || [],
    });
  } catch (error) {
    console.error("[API] Error fetching post status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}