import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/types/database";
import { createServerComponentClientWithAuth } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerComponentClientWithAuth();
    const db = supabase as unknown as { from: typeof supabase.from };

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const orgId = searchParams.get("orgId");
    const from = parseInt(searchParams.get("from") || "0", 10);
    const to = parseInt(searchParams.get("to") || "19", 10);

    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId parameter" }, { status: 400 });
    }

    // Verify user has access to this organization
    const userId = user.id as Database["public"]["Tables"]["org_members"]["Row"]["user_id"];

    const membership = await db
      .from("org_members")
      .select("role, user_id")
      .filter("org_id", "eq", orgId)
      .filter("user_id", "eq", userId)
      .maybeSingle();

    if (!membership.data) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Fetch paginated locations
    const { data: locations, error: locationsError, count } = await db
      .from("gbp_locations")
      .select("id, title, google_location_name, is_managed, sync_state", { count: "exact" })
      .filter("org_id", "eq", orgId)
      .order("title", { ascending: true, nullsFirst: false })
      .range(from, to);

    if (locationsError) {
      console.error("Error fetching locations:", locationsError);
      return NextResponse.json(
        { error: "Failed to fetch locations" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      locations: locations || [],
      totalCount: count || 0,
      from,
      to,
    });
  } catch (error) {
    console.error("Unexpected error in locations API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
