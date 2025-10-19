"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect";
import type { Database } from "@/types/database";
import {
  fetchGoogleLocations,
  extractLocationTitle,
  fetchGoogleReviews,
  fetchGoogleQuestions,
  fetchGooglePosts,
} from "@/lib/google-business";
import { createServerActionClientWithAuth, getServiceRoleClient } from "@/lib/supabase";
import { decryptRefreshToken } from "@/lib/encryption";

type MembershipRole = { role: Database["public"]["Enums"]["org_member_role"] };
type GbpLocationInsert = Database["public"]["Tables"]["gbp_locations"]["Insert"];

export async function syncLocationsAction(formData: FormData) {
  const supabase = await createServerActionClientWithAuth();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const orgIdValue = formData.get("orgId");
  const orgId = typeof orgIdValue === "string" ? orgIdValue.trim() : "";
  if (!orgId) {
    redirect("/integrations/google?status=missing_org");
  }

  const userId = user.id as Database["public"]["Tables"]["org_members"]["Row"]["user_id"];

  // Use service role client to bypass RLS for membership check
  const serviceRole = getServiceRoleClient();
  const membership = await serviceRole
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  const membershipData = membership.data as MembershipRole | null;

  if (
    membership.error ||
    !membershipData ||
    (membershipData.role !== "owner" && membershipData.role !== "admin")
  ) {
    redirect("/integrations/google?status=not_owner");
  }

  const connections = await serviceRole
    .from("connections_google")
    .select("account_id, refresh_token_enc")
    .filter("org_id", "eq", orgId);

  if (connections.error || !connections.data?.length) {
    redirect(`/integrations/google?orgId=${orgId}&status=no_connections`);
  }

  const accounts = await serviceRole
    .from("gbp_accounts")
    .select("id, google_account_name")
    .filter("org_id", "eq", orgId);

  if (accounts.error) {
    console.error(accounts.error);
    redirect(`/integrations/google?orgId=${orgId}&status=account_sync_failed`);
  }

  const accountMap = new Map(
    (accounts.data ?? [])
      .filter((acct) => acct.google_account_name)
      .map((acct) => [acct.google_account_name as string, acct.id]),
  );

  try {
    for (const connection of connections.data) {
      if (!connection.account_id || !connection.refresh_token_enc) {
        continue;
      }

      let refreshToken: string;
      try {
        refreshToken = decryptRefreshToken(connection.refresh_token_enc);
      } catch (error) {
        console.error("Failed to decrypt refresh token for account", connection.account_id, error);
        continue;
      }
      const locations = await fetchGoogleLocations(refreshToken, connection.account_id);

      if (!locations.length) {
        continue;
      }

      const mappedLocations: GbpLocationInsert[] = locations
        .filter((location) => location.name)
        .map((location) => ({
          org_id: orgId,
          account_id: accountMap.get(connection.account_id) ?? null,
          google_location_name: location.name as string,
          title: extractLocationTitle(location),
          meta: location as unknown as GbpLocationInsert["meta"],
          sync_state: {
            syncedAt: new Date().toISOString(),
            labels: location.labels ?? [],
          } as GbpLocationInsert["sync_state"],
        }));

      if (mappedLocations.length) {
        const upsert = await serviceRole
          .from("gbp_locations")
          .upsert(mappedLocations, { onConflict: "org_id,google_location_name" })
          .select("id");

        if (upsert.error) {
          console.error(upsert.error);
          redirect(`/integrations/google?orgId=${orgId}&status=locations_failed`);
        }
      }
    }
  } catch (error) {
    console.error("Google location sync failed", error);
    redirect(`/integrations/google?orgId=${orgId}&status=locations_failed`);
  }

  revalidatePath(`/integrations/google`);
  revalidatePath(`/orgs/${orgId}`);

  redirect(`/integrations/google?orgId=${orgId}&status=sync_success`);
}

export async function updateManagedLocationsAction(formData: FormData) {
  const supabase = await createServerActionClientWithAuth();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const orgIdValue = formData.get("orgId");
  const orgId = typeof orgIdValue === "string" ? orgIdValue.trim() : "";
  if (!orgId) {
    redirect("/integrations/google?status=missing_org");
  }

  const userId = user.id as Database["public"]["Tables"]["org_members"]["Row"]["user_id"];

  // Use service role client to bypass RLS for membership check
  const serviceRole = getServiceRoleClient();
  const membership = await serviceRole
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  const membershipData = membership.data as MembershipRole | null;

  if (
    membership.error ||
    !membershipData ||
    (membershipData.role !== "owner" && membershipData.role !== "admin")
  ) {
    redirect("/integrations/google?status=not_owner");
  }

  const managedIds = new Set<string>(
    formData.getAll("managedLocationIds").map((value) => String(value)),
  );

  const reset = await serviceRole
    .from("gbp_locations")
    .update({ is_managed: false })
    .filter("org_id", "eq", orgId);

  if (reset.error) {
    console.error(reset.error);
    redirect(`/integrations/google?orgId=${orgId}&status=save_failed`);
  }

  if (managedIds.size) {
    const enable = await serviceRole
      .from("gbp_locations")
      .update({ is_managed: true })
      .in("id", Array.from(managedIds));

    if (enable.error) {
      console.error(enable.error);
      redirect(`/integrations/google?orgId=${orgId}&status=save_failed`);
    }
  }

  revalidatePath(`/integrations/google`);
  revalidatePath(`/orgs/${orgId}`);

  redirect(`/integrations/google?orgId=${orgId}&status=save_success`);
}

export async function syncReviewsAndQAAction(formData: FormData) {
  const supabase = await createServerActionClientWithAuth();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const orgIdValue = formData.get("orgId");
  const orgId = typeof orgIdValue === "string" ? orgIdValue.trim() : "";
  if (!orgId) {
    redirect("/integrations/google?status=missing_org");
  }

  const userId = user.id as Database["public"]["Tables"]["org_members"]["Row"]["user_id"];

  // Use service role client to bypass RLS for membership check
  const serviceRole = getServiceRoleClient();
  const membership = await serviceRole
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  const membershipData = membership.data as MembershipRole | null;

  if (
    membership.error ||
    !membershipData ||
    (membershipData.role !== "owner" && membershipData.role !== "admin")
  ) {
    redirect("/integrations/google?status=not_owner");
  }

  // Get all managed locations for this org
  const { data: locations } = await serviceRole
    .from("gbp_locations")
    .select("id, google_location_name, org_id")
    .eq("org_id", orgId)
    .eq("is_managed", true);

  if (!locations || locations.length === 0) {
    redirect(`/integrations/google?orgId=${orgId}&status=no_locations`);
  }

  // Get connections to fetch refresh tokens
  const { data: connections } = await serviceRole
    .from("connections_google")
    .select("account_id, refresh_token_enc")
    .eq("org_id", orgId);

  if (!connections || connections.length === 0) {
    redirect(`/integrations/google?orgId=${orgId}&status=no_connections`);
  }

  // Use the first connection's refresh token
  let refreshToken: string | null = null;
  if (connections[0]?.refresh_token_enc) {
    try {
      refreshToken = decryptRefreshToken(connections[0].refresh_token_enc);
    } catch (error) {
      console.error("Failed to decrypt primary refresh token", error);
      refreshToken = null;
    }
  }
  if (!refreshToken) {
    redirect(`/integrations/google?orgId=${orgId}&status=no_connections`);
  }

  try {
    let totalReviews = 0;
    let totalQuestions = 0;
    let totalPosts = 0;
    const errors: string[] = [];

    console.log(`[Sync] Starting sync for ${locations.length} managed locations...`);

    for (const location of locations) {
      console.log(`[Sync] Syncing reviews and Q&A for location: ${location.google_location_name}`);

      // Fetch reviews
      try {
        const reviews = await fetchGoogleReviews(refreshToken, location.google_location_name);
        console.log(`[Sync] Found ${reviews.length} reviews for ${location.google_location_name}`);

        if (reviews.length > 0) {
          const reviewRecords = reviews.map((review) => ({
            org_id: orgId,
            location_id: location.id,
            review_id: review.reviewId ?? `review-${Date.now()}-${Math.random()}`,
            author: review.reviewer?.displayName ?? "Anonymous",
            rating: review.starRating ? parseInt(review.starRating.replace("STAR_RATING_", ""), 10) : null,
            text: review.comment ?? null,
            reply: review.reviewReply?.comment ?? null,
            state: "published" as const,
            created_at: review.createTime ?? new Date().toISOString(),
            updated_at: review.updateTime ?? new Date().toISOString(),
          }));

          const { error: reviewsError } = await serviceRole
            .from("gbp_reviews")
            .upsert(reviewRecords, { onConflict: "org_id,review_id" });

          if (reviewsError) {
            console.error(`[Sync] Error upserting reviews for ${location.google_location_name}:`, reviewsError);
          } else {
            totalReviews += reviews.length;
          }
        }
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[Sync] Error fetching reviews for ${location.google_location_name}:`, errorMsg);
        errors.push(`Reviews sync failed for ${location.google_location_name}: ${errorMsg}`);
        // Continue with other locations
      }

      // Fetch Q&A
      try {
        const questions = await fetchGoogleQuestions(refreshToken, location.google_location_name);
        console.log(`[Sync] Found ${questions.length} questions for ${location.google_location_name}`);

        if (questions.length > 0) {
          const qnaRecords = questions.map((question) => ({
            org_id: orgId,
            location_id: location.id,
            question_id: question.name ?? `qna-${Date.now()}-${Math.random()}`,
            question: question.text ?? "Unknown question",
            answer: question.topAnswers?.[0]?.text ?? null,
            state: "published",
            created_at: question.createTime ?? new Date().toISOString(),
            updated_at: question.createTime ?? new Date().toISOString(),
          }));

          const { error: qnaError } = await serviceRole
            .from("gbp_qna")
            .upsert(qnaRecords, { onConflict: "org_id,question_id" });

          if (qnaError) {
            console.error(`[Sync] Error upserting Q&A for ${location.google_location_name}:`, qnaError);
          } else {
            totalQuestions += questions.length;
          }
        }
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[Sync] Error fetching Q&A for ${location.google_location_name}:`, errorMsg);
        errors.push(`Q&A sync failed for ${location.google_location_name}: ${errorMsg}`);
        // Continue with other locations
      }

      // Fetch Posts
      try {
        const posts = await fetchGooglePosts(refreshToken, location.google_location_name);
        console.log(`[Sync] Found ${posts.length} posts for ${location.google_location_name}`);

        if (posts.length > 0) {
          const postRecords = posts.map((post) => ({
            org_id: orgId,
            location_id: location.id,
            google_post_name: post.name ?? `post-${Date.now()}-${Math.random()}`,
            summary: post.summary ?? null,
            topic_type: post.topicType ?? null,
            call_to_action_type: post.callToAction?.actionType ?? null,
            call_to_action_url: post.callToAction?.url ?? null,
            event_title: post.event?.title ?? null,
            event_start_date: post.event?.schedule?.startDate
              ? `${post.event.schedule.startDate.year}-${String(post.event.schedule.startDate.month).padStart(2, "0")}-${String(post.event.schedule.startDate.day).padStart(2, "0")}`
              : null,
            event_end_date: post.event?.schedule?.endDate
              ? `${post.event.schedule.endDate.year}-${String(post.event.schedule.endDate.month).padStart(2, "0")}-${String(post.event.schedule.endDate.day).padStart(2, "0")}`
              : null,
            offer_coupon_code: post.offer?.couponCode ?? null,
            offer_redeem_url: post.offer?.redeemOnlineUrl ?? null,
            offer_terms: post.offer?.termsConditions ?? null,
            media_urls: post.media?.map((m) => m.sourceUrl).filter((url): url is string => url !== null && url !== undefined) ?? [],
            state: post.state ?? null,
            search_url: post.searchUrl ?? null,
            meta: post as unknown as ReturnType<typeof JSON.parse>,
            google_create_time: post.createTime ?? null,
            google_update_time: post.updateTime ?? null,
          }));

          const { error: postsError } = await serviceRole
            .from("gbp_posts")
            .upsert(postRecords, { onConflict: "org_id,google_post_name" });

          if (postsError) {
            console.error(`[Sync] Error upserting posts for ${location.google_location_name}:`, postsError);
          } else {
            totalPosts += posts.length;
          }
        }
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[Sync] Error fetching posts for ${location.google_location_name}:`, errorMsg);
        errors.push(`Posts sync failed for ${location.google_location_name}: ${errorMsg}`);
        // Continue with other locations
      }
    }

    console.log(`[Sync] Completed: ${totalReviews} reviews, ${totalQuestions} Q&A, ${totalPosts} posts synced`);
    if (errors.length > 0) {
      console.log(`[Sync] Encountered ${errors.length} errors during sync:`, errors);
    }

    revalidatePath(`/integrations/google`);
    revalidatePath(`/reviews`);
    revalidatePath(`/content`);
    revalidatePath(`/locations`);
    revalidatePath(`/orgs/${orgId}`);

    redirect(`/integrations/google?orgId=${orgId}&status=content_synced`);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[Sync] Reviews and Q&A sync failed:", error);
    redirect(`/integrations/google?orgId=${orgId}&status=sync_failed`);
  }
}

export async function disconnectGoogleAction(formData: FormData) {
  const supabase = await createServerActionClientWithAuth();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const orgIdValue = formData.get("orgId");
  const orgId = typeof orgIdValue === "string" ? orgIdValue.trim() : "";
  if (!orgId) {
    redirect("/integrations/google?status=missing_org");
  }

  const userId = user.id as Database["public"]["Tables"]["org_members"]["Row"]["user_id"];

  // Use service role client to bypass RLS for membership check
  const serviceRole = getServiceRoleClient();
  const membership = await serviceRole
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  const membershipData = membership.data as MembershipRole | null;

  if (membership.error || !membershipData || membershipData.role !== "owner") {
    redirect("/integrations/google?status=not_owner");
  }

  console.log(`[Disconnect] Removing Google connections for org: ${orgId}`);

  // Delete connections (cascades to related data via FK constraints)
  const { error: connectionsError } = await serviceRole
    .from("connections_google")
    .delete()
    .eq("org_id", orgId);

  if (connectionsError) {
    console.error("[Disconnect] Error deleting connections:", connectionsError);
    redirect(`/integrations/google?orgId=${orgId}&status=disconnect_failed`);
  }

  // Delete GBP accounts
  const { error: accountsError } = await serviceRole
    .from("gbp_accounts")
    .delete()
    .eq("org_id", orgId);

  if (accountsError) {
    console.error("[Disconnect] Error deleting accounts:", accountsError);
    redirect(`/integrations/google?orgId=${orgId}&status=disconnect_failed`);
  }

  console.log("[Disconnect] Successfully disconnected Google account");

  revalidatePath(`/integrations/google`);
  revalidatePath(`/locations`);
  revalidatePath(`/reviews`);
  revalidatePath(`/content`);
  revalidatePath(`/orgs/${orgId}`);

  redirect(`/integrations/google?orgId=${orgId}&status=disconnected`);
}
