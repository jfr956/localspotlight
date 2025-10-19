import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirectTarget = new URL("/api/google/oauth/callback", url.origin);

  url.searchParams.forEach((value, key) => {
    redirectTarget.searchParams.set(key, value);
  });

  return NextResponse.redirect(redirectTarget);
}

