"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
  console.log("========================================");
  console.log("[SYNC START] syncReviewsAndQAAction initiated");
  console.log("========================================");

  const supabase = await createServerActionClientWithAuth();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.log("[AUTH] User authentication check:", {
    userId: user?.id,
    email: user?.email,
    authenticated: !!user,
  });

  if (!user) {
    console.log("[AUTH] No user found, redirecting to sign-in");
    redirect("/sign-in");
  }

  const orgIdValue = formData.get("orgId");
  const orgId = typeof orgIdValue === "string" ? orgIdValue.trim() : "";
  console.log("[ORG] Organization ID from form data:", {
    rawValue: orgIdValue,
    processedOrgId: orgId,
    isValid: !!orgId,
  });

  if (!orgId) {
    console.log("[ORG] Missing org ID, redirecting with error");
    redirect("/integrations/google?status=missing_org");
  }

  const userId = user.id as Database["public"]["Tables"]["org_members"]["Row"]["user_id"];

  // Use service role client to bypass RLS for membership check
  const serviceRole = getServiceRoleClient();
  console.log("[DB] Service role client created for membership check");

  console.log("[MEMBERSHIP] Checking user membership for org:", {
    orgId,
    userId,
  });

  const membership = await serviceRole
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  const membershipData = membership.data as MembershipRole | null;

  console.log("[MEMBERSHIP] Membership query result:", {
    hasError: !!membership.error,
    error: membership.error,
    hasData: !!membershipData,
    role: membershipData?.role,
  });

  if (
    membership.error ||
    !membershipData ||
    (membershipData.role !== "owner" && membershipData.role !== "admin")
  ) {
    console.log("[MEMBERSHIP] User not authorized (not owner/admin), redirecting");
    redirect("/integrations/google?status=not_owner");
  }

  console.log("[MEMBERSHIP] User authorized with role:", membershipData.role);

  // Get all managed locations for this org with their account info
  console.log("[LOCATIONS] Fetching managed locations for org:", orgId);

  const locationsQuery = await serviceRole
    .from("gbp_locations")
    .select("id, google_location_name, org_id, account_id, gbp_accounts!inner(google_account_name)")
    .eq("org_id", orgId)
    .eq("is_managed", true);

  console.log("[LOCATIONS] Query result:", {
    hasError: !!locationsQuery.error,
    error: locationsQuery.error,
    locationCount: locationsQuery.data?.length ?? 0,
    locations: locationsQuery.data?.map((loc) => ({
      id: loc.id,
      googleName: loc.google_location_name,
      accountInfo: loc.gbp_accounts,
    })),
  });

  const locations = locationsQuery.data;

  if (!locations || locations.length === 0) {
    console.log("[LOCATIONS] No managed locations found, redirecting");
    redirect(`/integrations/google?orgId=${orgId}&status=no_locations`);
  }

  // Get connections to fetch refresh tokens
  console.log("[CONNECTIONS] Fetching Google connections for org:", orgId);

  const connectionsQuery = await serviceRole
    .from("connections_google")
    .select("account_id, refresh_token_enc")
    .eq("org_id", orgId);

  console.log("[CONNECTIONS] Query result:", {
    hasError: !!connectionsQuery.error,
    error: connectionsQuery.error,
    connectionCount: connectionsQuery.data?.length ?? 0,
    accountIds: connectionsQuery.data?.map((c) => c.account_id),
  });

  const connections = connectionsQuery.data;

  if (!connections || connections.length === 0) {
    console.log("[CONNECTIONS] No connections found, redirecting");
    redirect(`/integrations/google?orgId=${orgId}&status=no_connections`);
  }

  // Use the first connection's refresh token
  console.log("[TOKEN] Attempting to decrypt refresh token from first connection");
  console.log("[TOKEN] Connection details:", {
    accountId: connections[0]?.account_id,
    hasRefreshTokenEnc: !!connections[0]?.refresh_token_enc,
    refreshTokenEncLength: connections[0]?.refresh_token_enc?.length,
  });

  let refreshToken: string | null = null;
  if (connections[0]?.refresh_token_enc) {
    try {
      console.log("[TOKEN] Starting decryption...");
      refreshToken = decryptRefreshToken(connections[0].refresh_token_enc);
      console.log("[TOKEN] Decryption successful:", {
        refreshTokenLength: refreshToken.length,
        refreshTokenPrefix: refreshToken.substring(0, 20) + "...",
      });
    } catch (error) {
      console.error("[TOKEN] Failed to decrypt refresh token:", {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      refreshToken = null;
    }
  }

  if (!refreshToken) {
    console.log("[TOKEN] No valid refresh token available, redirecting");
    redirect(`/integrations/google?orgId=${orgId}&status=no_connections`);
  }

  try {
    let totalReviews = 0;
    let totalQuestions = 0;
    let totalPosts = 0;
    const errors: string[] = [];

    console.log("\n========================================");
    console.log(`[SYNC] Starting content sync for ${locations.length} managed locations`);
    console.log("========================================\n");

    for (const location of locations) {
      console.log(`\n--- [LOCATION START] ${location.google_location_name} ---`);
      console.log(`[LOCATION] Details:`, {
        id: location.id,
        googleLocationName: location.google_location_name,
        orgId: location.org_id,
        accountId: location.account_id,
        accountInfo: location.gbp_accounts,
      });

      // Get accountId from the joined gbp_accounts table
      const accountRecord = Array.isArray(location.gbp_accounts) ? location.gbp_accounts[0] : location.gbp_accounts;
      const googleAccountName = accountRecord?.google_account_name;

      if (!googleAccountName) {
        console.error(`[LOCATION] No google_account_name found for location ${location.google_location_name}`);
        errors.push(`No account found for location ${location.google_location_name}`);
        continue;
      }

      // Extract accountId from google_account_name (format: accounts/{accountId})
      const accountMatch = googleAccountName.match(/accounts\/([^/]+)/);
      if (!accountMatch) {
        console.error(`[LOCATION] Invalid google_account_name format: ${googleAccountName}`);
        errors.push(`Invalid account name format: ${googleAccountName}`);
        continue;
      }
      const accountId = accountMatch[1];

      // Extract locationId from google_location_name (format: locations/{locationId})
      const locationMatch = location.google_location_name?.match(/locations\/([^/]+)/);
      if (!locationMatch) {
        console.error(`[LOCATION] Invalid google_location_name format: ${location.google_location_name}`);
        errors.push(`Invalid location name format for ${location.google_location_name}`);
        continue;
      }
      const locationId = locationMatch[1];

      console.log(`[LOCATION] Parsed IDs:`, {
        accountId,
        locationId,
        googleAccountName,
        googleLocationName: location.google_location_name,
      });

      // ========================================
      // REVIEWS SYNC
      // ========================================
      console.log(`\n[REVIEWS] Fetching reviews for ${location.google_location_name}`);
      try {
        console.log(`[REVIEWS] API Call: fetchGoogleReviews(refreshToken, "${accountId}", "${locationId}")`);

        const reviewsStartTime = Date.now();
        const reviews = await fetchGoogleReviews(refreshToken, accountId, locationId);
        const reviewsEndTime = Date.now();

        console.log(`[REVIEWS] API Response received in ${reviewsEndTime - reviewsStartTime}ms:`, {
          reviewCount: reviews.length,
          hasData: reviews.length > 0,
        });

        if (reviews.length > 0) {
          console.log(`[REVIEWS] Processing ${reviews.length} reviews...`);

          // Log first review as sample
          console.log(`[REVIEWS] Sample review (first):`, {
            reviewId: reviews[0]?.reviewId,
            author: reviews[0]?.reviewer?.displayName,
            rating: reviews[0]?.starRating,
            hasComment: !!reviews[0]?.comment,
            commentLength: reviews[0]?.comment?.length,
            hasReply: !!reviews[0]?.reviewReply?.comment,
            createTime: reviews[0]?.createTime,
            updateTime: reviews[0]?.updateTime,
          });

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

          console.log(`[REVIEWS] Mapped ${reviewRecords.length} review records for database insertion`);
          console.log(`[REVIEWS] Sample mapped record (first):`, {
            org_id: reviewRecords[0]?.org_id,
            location_id: reviewRecords[0]?.location_id,
            review_id: reviewRecords[0]?.review_id,
            author: reviewRecords[0]?.author,
            rating: reviewRecords[0]?.rating,
            hasText: !!reviewRecords[0]?.text,
            hasReply: !!reviewRecords[0]?.reply,
            state: reviewRecords[0]?.state,
          });

          console.log(`[REVIEWS] Upserting to database...`);
          const upsertStartTime = Date.now();

          const { error: reviewsError, count, data: upsertedData } = await serviceRole
            .from("gbp_reviews")
            .upsert(reviewRecords, { onConflict: "org_id,review_id" })
            .select();

          const upsertEndTime = Date.now();

          console.log(`[REVIEWS] Database upsert completed in ${upsertEndTime - upsertStartTime}ms:`, {
            hasError: !!reviewsError,
            error: reviewsError,
            recordsUpserted: upsertedData?.length ?? count,
            affectedRecords: reviewRecords.length,
          });

          if (reviewsError) {
            console.error(`[REVIEWS] ERROR during database upsert:`, {
              error: reviewsError,
              message: reviewsError.message,
              details: reviewsError.details,
              hint: reviewsError.hint,
              code: reviewsError.code,
            });
            errors.push(`Reviews DB error for ${location.google_location_name}: ${reviewsError.message}`);
          } else {
            totalReviews += reviews.length;
            console.log(`[REVIEWS] ✓ Successfully synced ${reviews.length} reviews`);
          }
        } else {
          console.log(`[REVIEWS] No reviews found for this location`);
        }
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[REVIEWS] EXCEPTION during fetch/process:`, {
          error,
          errorMessage: errorMsg,
          errorStack: error instanceof Error ? error.stack : undefined,
          errorType: error?.constructor?.name,
        });
        errors.push(`Reviews sync failed for ${location.google_location_name}: ${errorMsg}`);
      }

      // ========================================
      // Q&A SYNC
      // ========================================
      console.log(`\n[Q&A] Fetching questions for ${location.google_location_name}`);
      try {
        console.log(`[Q&A] API Call: fetchGoogleQuestions(refreshToken, "${location.google_location_name}")`);

        const qnaStartTime = Date.now();
        const questions = await fetchGoogleQuestions(refreshToken, location.google_location_name);
        const qnaEndTime = Date.now();

        console.log(`[Q&A] API Response received in ${qnaEndTime - qnaStartTime}ms:`, {
          questionCount: questions.length,
          hasData: questions.length > 0,
        });

        if (questions.length > 0) {
          console.log(`[Q&A] Processing ${questions.length} questions...`);

          // Log first question as sample
          console.log(`[Q&A] Sample question (first):`, {
            questionId: questions[0]?.name,
            text: questions[0]?.text?.substring(0, 100),
            hasAnswers: !!questions[0]?.topAnswers?.length,
            answerCount: questions[0]?.topAnswers?.length,
            firstAnswer: questions[0]?.topAnswers?.[0]?.text?.substring(0, 100),
            createTime: questions[0]?.createTime,
          });

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

          console.log(`[Q&A] Mapped ${qnaRecords.length} Q&A records for database insertion`);
          console.log(`[Q&A] Sample mapped record (first):`, {
            org_id: qnaRecords[0]?.org_id,
            location_id: qnaRecords[0]?.location_id,
            question_id: qnaRecords[0]?.question_id,
            questionPreview: qnaRecords[0]?.question?.substring(0, 50),
            hasAnswer: !!qnaRecords[0]?.answer,
            answerPreview: qnaRecords[0]?.answer?.substring(0, 50),
            state: qnaRecords[0]?.state,
          });

          console.log(`[Q&A] Upserting to database...`);
          const upsertStartTime = Date.now();

          const { error: qnaError, count, data: upsertedData } = await serviceRole
            .from("gbp_qna")
            .upsert(qnaRecords, { onConflict: "org_id,question_id" })
            .select();

          const upsertEndTime = Date.now();

          console.log(`[Q&A] Database upsert completed in ${upsertEndTime - upsertStartTime}ms:`, {
            hasError: !!qnaError,
            error: qnaError,
            recordsUpserted: upsertedData?.length ?? count,
            affectedRecords: qnaRecords.length,
          });

          if (qnaError) {
            console.error(`[Q&A] ERROR during database upsert:`, {
              error: qnaError,
              message: qnaError.message,
              details: qnaError.details,
              hint: qnaError.hint,
              code: qnaError.code,
            });
            errors.push(`Q&A DB error for ${location.google_location_name}: ${qnaError.message}`);
          } else {
            totalQuestions += questions.length;
            console.log(`[Q&A] ✓ Successfully synced ${questions.length} questions`);
          }
        } else {
          console.log(`[Q&A] No questions found for this location`);
        }
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[Q&A] EXCEPTION during fetch/process:`, {
          error,
          errorMessage: errorMsg,
          errorStack: error instanceof Error ? error.stack : undefined,
          errorType: error?.constructor?.name,
        });
        errors.push(`Q&A sync failed for ${location.google_location_name}: ${errorMsg}`);
      }

      // ========================================
      // POSTS SYNC
      // ========================================
      console.log(`\n[POSTS] Fetching posts for ${location.google_location_name}`);
      try {
        console.log(`[POSTS] API Call: fetchGooglePosts(refreshToken, "${accountId}", "${locationId}")`);

        const postsStartTime = Date.now();
        const posts = await fetchGooglePosts(refreshToken, accountId, locationId);
        const postsEndTime = Date.now();

        console.log(`[POSTS] API Response received in ${postsEndTime - postsStartTime}ms:`, {
          postCount: posts.length,
          hasData: posts.length > 0,
        });

        if (posts.length > 0) {
          console.log(`[POSTS] Processing ${posts.length} posts...`);

          // Log first post as sample
          console.log(`[POSTS] Sample post (first):`, {
            postName: posts[0]?.name,
            summary: posts[0]?.summary?.substring(0, 100),
            topicType: posts[0]?.topicType,
            hasCallToAction: !!posts[0]?.callToAction,
            actionType: posts[0]?.callToAction?.actionType,
            hasEvent: !!posts[0]?.event,
            hasOffer: !!posts[0]?.offer,
            mediaCount: posts[0]?.media?.length,
            state: posts[0]?.state,
            createTime: posts[0]?.createTime,
          });

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

          console.log(`[POSTS] Mapped ${postRecords.length} post records for database insertion`);
          console.log(`[POSTS] Sample mapped record (first):`, {
            org_id: postRecords[0]?.org_id,
            location_id: postRecords[0]?.location_id,
            google_post_name: postRecords[0]?.google_post_name,
            summaryPreview: postRecords[0]?.summary?.substring(0, 50),
            topic_type: postRecords[0]?.topic_type,
            call_to_action_type: postRecords[0]?.call_to_action_type,
            mediaUrlCount: postRecords[0]?.media_urls?.length,
            state: postRecords[0]?.state,
          });

          console.log(`[POSTS] Upserting to database...`);
          const upsertStartTime = Date.now();

          const { error: postsError, count, data: upsertedData } = await serviceRole
            .from("gbp_posts")
            .upsert(postRecords, { onConflict: "org_id,google_post_name" })
            .select();

          const upsertEndTime = Date.now();

          console.log(`[POSTS] Database upsert completed in ${upsertEndTime - upsertStartTime}ms:`, {
            hasError: !!postsError,
            error: postsError,
            recordsUpserted: upsertedData?.length ?? count,
            affectedRecords: postRecords.length,
          });

          if (postsError) {
            console.error(`[POSTS] ERROR during database upsert:`, {
              error: postsError,
              message: postsError.message,
              details: postsError.details,
              hint: postsError.hint,
              code: postsError.code,
            });
            errors.push(`Posts DB error for ${location.google_location_name}: ${postsError.message}`);
          } else {
            totalPosts += posts.length;
            console.log(`[POSTS] ✓ Successfully synced ${posts.length} posts`);
          }
        } else {
          console.log(`[POSTS] No posts found for this location`);
        }
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[POSTS] EXCEPTION during fetch/process:`, {
          error,
          errorMessage: errorMsg,
          errorStack: error instanceof Error ? error.stack : undefined,
          errorType: error?.constructor?.name,
        });
        errors.push(`Posts sync failed for ${location.google_location_name}: ${errorMsg}`);
      }

      console.log(`--- [LOCATION END] ${location.google_location_name} ---\n`);
    }

    console.log("\n========================================");
    console.log("[SYNC COMPLETE] Final Summary:");
    console.log("========================================");
    console.log(`Total Reviews Synced: ${totalReviews}`);
    console.log(`Total Questions Synced: ${totalQuestions}`);
    console.log(`Total Posts Synced: ${totalPosts}`);
    console.log(`Total Errors Encountered: ${errors.length}`);

    if (errors.length > 0) {
      console.log("\n[ERRORS] Detailed error list:");
      errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    console.log("\n[REVALIDATION] Revalidating cache paths...");
    revalidatePath(`/integrations/google`);
    revalidatePath(`/reviews`);
    revalidatePath(`/content`);
    revalidatePath(`/locations`);
    revalidatePath(`/orgs/${orgId}`);
    console.log("[REVALIDATION] Complete");

    // Detect if no content was synced at all - likely API access pending
    const totalSynced = totalReviews + totalQuestions + totalPosts;

    if (totalSynced === 0 && locations.length > 0) {
      console.log("\n[API ACCESS] No content synced from any location - API access may be pending");
      console.log("[REDIRECT] Redirecting with api_access_pending status...");
      redirect(`/integrations/google?orgId=${orgId}&status=api_access_pending`);
    }

    console.log("\n[REDIRECT] Redirecting to success page...");
    redirect(`/integrations/google?orgId=${orgId}&status=content_synced`);
  } catch (error) {
    // Check if this is a redirect by examining the error properties
    // Next.js redirect() throws a special error with NEXT_REDIRECT property
    if (error && typeof error === 'object' && 'digest' in error &&
        typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')) {
      console.log("[REDIRECT] Redirect error caught (expected behavior), rethrowing");
      throw error;
    }
    console.error("\n========================================");
    console.error("[SYNC FAILED] Unexpected error during sync:");
    console.error("========================================");
    console.error("[ERROR] Details:", {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      errorType: error?.constructor?.name,
    });
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
