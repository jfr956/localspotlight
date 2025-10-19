import { NextResponse } from "next/server";
import { createRouteHandlerClientWithAuth } from "@/lib/supabase";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const supabase = await createRouteHandlerClientWithAuth();
    await supabase.auth.exchangeCodeForSession(code);
    return NextResponse.redirect(new URL("/", requestUrl.origin));
  }

  // fallback if no code is present
  const redirectTo = requestUrl.searchParams.get("redirect") ?? "/";
  return NextResponse.redirect(new URL(redirectTo, requestUrl.origin));
}
