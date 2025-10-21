import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const generationId = searchParams.get("gen");

  if (!generationId) {
    return NextResponse.json({ error: "Missing generation id" }, { status: 400 });
  }

  const serviceRole = getServiceRoleClient();

  const [{ data: generation, error: generationError }, { data: events }] =
    await Promise.all([
      serviceRole
        .from("ai_generations")
        .select("id, status, model, risk_score, output, created_at")
        .eq("id", generationId)
        .maybeSingle(),
      // TODO: Re-enable when ai_generation_events table is created
      // serviceRole
      //   .from("ai_generation_events")
      //   .select("id, level, message, created_at, meta")
      //   .eq("generation_id", generationId)
      //   .order("created_at", { ascending: true }),
      Promise.resolve({ data: [], error: null }),
    ]);

  if (generationError) {
    return NextResponse.json({ error: generationError.message }, { status: 500 });
  }

  if (!generation) {
    return NextResponse.json({ error: "Generation not found" }, { status: 404 });
  }

  // Events error check removed since events query is temporarily disabled

  return NextResponse.json({ snapshot: generation, events: events || [] });
}


