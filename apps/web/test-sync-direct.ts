/**
 * Direct sync test - bypasses Next.js server actions
 *
 * This script directly calls the Google API functions and inserts into database
 * to test the core sync logic without Next.js request context requirements.
 */

// Load environment variables
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./src/types/database";
import {
  fetchGoogleQuestions,
  fetchGoogleReviews,
  fetchGooglePosts,
} from "./src/lib/google-business";
import { decryptRefreshToken } from "./src/lib/encryption";

const ORG_ID = "a684026d-5676-48f8-a249-a5bd662f8552";
const LOCATION_ID = "bd868b66-9091-4042-a901-a80b81cd3112"; // Texas Lone Star AC & Heating

async function main() {
  console.log("========================================");
  console.log("DIRECT SYNC TEST");
  console.log("========================================\n");

  // Create Supabase service role client
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log("[1] Fetching location details from database...");
  const { data: location, error: locError } = await supabase
    .from("gbp_locations")
    .select("id, google_location_name, org_id")
    .eq("id", LOCATION_ID)
    .single();

  if (locError || !location) {
    console.error("ERROR: Failed to fetch location:", locError);
    process.exit(1);
  }

  console.log("Location found:", {
    id: location.id,
    googleName: location.google_location_name,
    orgId: location.org_id,
  });

  console.log("\n[2] Fetching Google OAuth refresh token...");
  const { data: connections, error: connError } = await supabase
    .from("connections_google")
    .select("refresh_token_enc")
    .eq("org_id", ORG_ID)
    .limit(1);

  if (connError || !connections || connections.length === 0) {
    console.error("ERROR: Failed to fetch connection:", connError);
    process.exit(1);
  }

  console.log(`Found ${connections.length} connection(s), using first one`);
  console.log("Decrypting token...");
  const refreshToken = decryptRefreshToken(connections[0].refresh_token_enc);
  console.log("✓ Token decrypted successfully (length:", refreshToken.length, ")");

  // ========================================
  // TEST Q&A SYNC
  // ========================================
  console.log("\n========================================");
  console.log("[3] TESTING Q&A SYNC");
  console.log("========================================");

  try {
    console.log("Fetching questions from Google API...");
    const questions = await fetchGoogleQuestions(refreshToken, location.google_location_name);
    console.log(`✓ Fetched ${questions.length} questions from Google`);

    if (questions.length > 0) {
      console.log("\nSample question:");
      console.log("  Question:", questions[0]?.text?.substring(0, 100));
      console.log("  Has Answer:", !!questions[0]?.topAnswers?.length);
      console.log("  First Answer:", questions[0]?.topAnswers?.[0]?.text?.substring(0, 100));

      console.log("\nMapping to database records...");
      const qnaRecords = questions.map((question) => ({
        org_id: ORG_ID,
        location_id: location.id,
        question_id: question.name ?? `qna-${Date.now()}-${Math.random()}`,
        question: question.text ?? "Unknown question",
        answer: question.topAnswers?.[0]?.text ?? null,
        state: "published" as const,
        created_at: question.createTime ?? new Date().toISOString(),
        updated_at: question.createTime ?? new Date().toISOString(),
      }));

      console.log(`Mapped ${qnaRecords.length} records`);

      console.log("\nInserting into database...");
      const { data: inserted, error: qnaError } = await supabase
        .from("gbp_qna")
        .upsert(qnaRecords, { onConflict: "org_id,question_id" })
        .select();

      if (qnaError) {
        console.error("✗ ERROR inserting Q&A:", qnaError);
      } else {
        console.log(`✓ Successfully inserted/updated ${inserted?.length ?? 0} Q&A records`);
      }
    } else {
      console.log("⚠️  No questions found");
    }
  } catch (error) {
    console.error("✗ ERROR during Q&A sync:", error);
  }

  // ========================================
  // TEST REVIEWS SYNC
  // ========================================
  console.log("\n========================================");
  console.log("[4] TESTING REVIEWS SYNC");
  console.log("========================================");

  try {
    console.log("Fetching reviews from Google API...");
    const reviews = await fetchGoogleReviews(refreshToken, location.google_location_name);
    console.log(`✓ Fetched ${reviews.length} reviews from Google`);

    if (reviews.length > 0) {
      console.log("\nSample review:");
      console.log("  Author:", reviews[0]?.reviewer?.displayName);
      console.log("  Rating:", reviews[0]?.starRating);
      console.log("  Comment:", reviews[0]?.comment?.substring(0, 100));

      console.log("\nMapping to database records...");
      const reviewRecords = reviews.map((review) => ({
        org_id: ORG_ID,
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

      console.log(`Mapped ${reviewRecords.length} records`);

      console.log("\nInserting into database...");
      const { data: inserted, error: reviewError } = await supabase
        .from("gbp_reviews")
        .upsert(reviewRecords, { onConflict: "org_id,review_id" })
        .select();

      if (reviewError) {
        console.error("✗ ERROR inserting reviews:", reviewError);
      } else {
        console.log(`✓ Successfully inserted/updated ${inserted?.length ?? 0} review records`);
      }
    } else {
      console.log("⚠️  No reviews found");
    }
  } catch (error) {
    console.error("✗ ERROR during reviews sync:", error);
  }

  // ========================================
  // TEST POSTS SYNC
  // ========================================
  console.log("\n========================================");
  console.log("[5] TESTING POSTS SYNC");
  console.log("========================================");

  try {
    console.log("Fetching posts from Google API...");
    const posts = await fetchGooglePosts(refreshToken, location.google_location_name);
    console.log(`✓ Fetched ${posts.length} posts from Google`);

    if (posts.length > 0) {
      console.log("\nSample post:");
      console.log("  Summary:", posts[0]?.summary?.substring(0, 100));
      console.log("  Topic Type:", posts[0]?.topicType);
      console.log("  State:", posts[0]?.state);

      console.log("\nMapping to database records...");
      const postRecords = posts.map((post) => ({
        org_id: ORG_ID,
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

      console.log(`Mapped ${postRecords.length} records`);

      console.log("\nInserting into database...");
      const { data: inserted, error: postError } = await supabase
        .from("gbp_posts")
        .upsert(postRecords, { onConflict: "org_id,google_post_name" })
        .select();

      if (postError) {
        console.error("✗ ERROR inserting posts:", postError);
      } else {
        console.log(`✓ Successfully inserted/updated ${inserted?.length ?? 0} post records`);
      }
    } else {
      console.log("⚠️  No posts found");
    }
  } catch (error) {
    console.error("✗ ERROR during posts sync:", error);
  }

  // ========================================
  // VERIFY DATA
  // ========================================
  console.log("\n========================================");
  console.log("[6] VERIFYING DATA IN DATABASE");
  console.log("========================================");

  const { count: qnaCount } = await supabase
    .from("gbp_qna")
    .select("*", { count: "exact", head: true })
    .eq("org_id", ORG_ID);

  const { count: reviewCount } = await supabase
    .from("gbp_reviews")
    .select("*", { count: "exact", head: true })
    .eq("org_id", ORG_ID);

  const { count: postCount } = await supabase
    .from("gbp_posts")
    .select("*", { count: "exact", head: true })
    .eq("org_id", ORG_ID);

  console.log("\nDatabase counts:");
  console.log(`  Q&A: ${qnaCount ?? 0}`);
  console.log(`  Reviews: ${reviewCount ?? 0}`);
  console.log(`  Posts: ${postCount ?? 0}`);

  // Show some sample Q&A data
  if (qnaCount && qnaCount > 0) {
    console.log("\nSample Q&A from database:");
    const { data: sampleQna } = await supabase
      .from("gbp_qna")
      .select("question, answer")
      .eq("org_id", ORG_ID)
      .limit(3);

    sampleQna?.forEach((qa, index) => {
      console.log(`\n  ${index + 1}. Q: ${qa.question?.substring(0, 80)}${qa.question && qa.question.length > 80 ? "..." : ""}`);
      console.log(`     A: ${qa.answer?.substring(0, 80)}${qa.answer && qa.answer.length > 80 ? "..." : ""}`);
    });
  }

  console.log("\n========================================");
  console.log("TEST COMPLETE");
  console.log("========================================");
}

main().catch((error) => {
  console.error("\nFATAL ERROR:");
  console.error(error);
  process.exit(1);
});
