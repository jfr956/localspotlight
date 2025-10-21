/**
 * Direct test script for Google Business Profile Posts
 *
 * This tests the library functions directly without going through API routes.
 * Useful for debugging and verifying the Google API integration.
 *
 * Usage:
 *   tsx test-posts-direct.ts
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./src/types/database";
import { fetchGooglePosts, createGooglePost, extractAccountId, extractLocationId } from "./src/lib/google-business";
import { decryptRefreshToken } from "./src/lib/encryption";
import type { CreatePostRequest } from "./src/lib/google-business";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing environment variables");
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

async function testPostsDirect() {
  console.log("=".repeat(80));
  console.log("Direct Test: Google Business Profile Posts");
  console.log("=".repeat(80));
  console.log();

  // Get connection and location
  console.log("Finding test location...");
  const { data: location, error: locError } = await supabase
    .from("gbp_locations")
    .select("id, title, google_location_name, account_id, org_id")
    .eq("is_managed", true)
    .limit(1)
    .single();

  if (locError || !location) {
    console.error("❌ No managed location found");
    process.exit(1);
  }

  console.log(`✓ Location: ${location.title}`);
  console.log(`  ID: ${location.id}`);
  console.log(`  Google Location: ${location.google_location_name}`);
  console.log();

  // Get connection
  const { data: connection, error: connError } = await supabase
    .from("connections_google")
    .select("refresh_token_enc")
    .eq("account_id", location.account_id || "")
    .single();

  if (connError || !connection) {
    console.error("❌ No connection found");
    process.exit(1);
  }

  // Decrypt token
  let refreshToken: string;
  try {
    refreshToken = decryptRefreshToken(connection.refresh_token_enc);
    console.log("✓ Decrypted refresh token");
  } catch (error) {
    console.error("❌ Failed to decrypt token:", error);
    process.exit(1);
  }

  const accountId = extractAccountId(location.account_id || "");
  const locationId = extractLocationId(location.google_location_name);

  console.log(`Account ID: ${accountId}`);
  console.log(`Location ID: ${locationId}`);
  console.log();

  // Test 1: Fetch existing posts
  console.log("=".repeat(80));
  console.log("Test 1: Fetching existing posts");
  console.log("=".repeat(80));
  console.log();

  try {
    const posts = await fetchGooglePosts(refreshToken, accountId, locationId);
    console.log(`✓ Fetched ${posts.length} posts`);

    if (posts.length > 0) {
      console.log("\nSample posts:");
      posts.slice(0, 3).forEach((post, i) => {
        console.log(`\n${i + 1}. ${post.topicType || "UNKNOWN"}`);
        console.log(`   Name: ${post.name}`);
        console.log(`   Summary: ${post.summary?.substring(0, 80)}...`);
        console.log(`   State: ${post.state}`);
        console.log(`   Created: ${post.createTime}`);
        if (post.callToAction) {
          console.log(`   CTA: ${post.callToAction.actionType} -> ${post.callToAction.url}`);
        }
      });
    }
    console.log();
  } catch (error) {
    console.error("❌ Error fetching posts:", error);
  }

  // Test 2: Create a new post
  console.log("=".repeat(80));
  console.log("Test 2: Creating a new post");
  console.log("=".repeat(80));
  console.log();

  const newPost: CreatePostRequest = {
    languageCode: "en",
    summary: `LocalSpotlight Test Post - ${new Date().toLocaleString()}\n\nThis is a test post created via the LocalSpotlight platform to verify our Google Business Profile API integration. We're excited to help businesses manage their online presence more effectively! 🚀`,
    topicType: "STANDARD",
    callToAction: {
      actionType: "LEARN_MORE",
      url: "https://localspotlight.app",
    },
  };

  console.log("Post content:");
  console.log(JSON.stringify(newPost, null, 2));
  console.log();

  try {
    console.log("Creating post...");
    const createdPost = await createGooglePost(refreshToken, accountId, locationId, newPost);

    console.log("✓ Post created successfully!");
    console.log();
    console.log("Created post details:");
    console.log(`  Name: ${createdPost.name}`);
    console.log(`  Topic Type: ${createdPost.topicType}`);
    console.log(`  State: ${createdPost.state}`);
    console.log(`  Language: ${createdPost.languageCode}`);
    console.log(`  Created: ${createdPost.createTime}`);

    if (createdPost.searchUrl) {
      console.log();
      console.log(`🔗 View post: ${createdPost.searchUrl}`);
    }

    console.log();
    console.log("Raw response:");
    console.log(JSON.stringify(createdPost, null, 2));
    console.log();

    // Store in database
    console.log("Storing post in database...");

    const { error: insertError } = await supabase.from("gbp_posts").insert({
      org_id: location.org_id,
      location_id: location.id,
      google_post_name: createdPost.name || "",
      summary: createdPost.summary || null,
      topic_type: createdPost.topicType || null,
      call_to_action_type: createdPost.callToAction?.actionType || null,
      call_to_action_url: createdPost.callToAction?.url || null,
      state: createdPost.state || null,
      search_url: createdPost.searchUrl || null,
      meta: createdPost as any,
      google_create_time: createdPost.createTime || null,
      google_update_time: createdPost.updateTime || null,
    });

    if (insertError) {
      console.error("❌ Error storing in database:", insertError);
    } else {
      console.log("✓ Post stored in database");
    }

    console.log();
  } catch (error) {
    console.error("❌ Error creating post:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Stack:", error.stack);
    }
  }

  console.log("=".repeat(80));
  console.log("Test completed!");
  console.log("=".repeat(80));
}

// Run the test
testPostsDirect().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
