/**
 * Test script for Google Business Profile Posts API
 *
 * This script tests:
 * 1. Syncing existing posts from Google
 * 2. Creating a new post via the API
 *
 * Prerequisites:
 * - User must be authenticated (have valid session cookies)
 * - Organization must have Google connection set up
 * - At least one managed location must exist
 *
 * Usage:
 *   tsx test-posts-api.ts
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./src/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing environment variables:");
  console.error("NEXT_PUBLIC_SUPABASE_URL:", !!supabaseUrl);
  console.error("SUPABASE_SERVICE_ROLE_KEY:", !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

async function testPostsAPI() {
  console.log("=".repeat(80));
  console.log("Testing Google Business Profile Posts API");
  console.log("=".repeat(80));
  console.log();

  // Step 1: Get an organization with Google connection
  console.log("Step 1: Finding organization with Google connection...");
  const { data: connections, error: connError } = await supabase
    .from("connections_google")
    .select("org_id, account_id")
    .limit(1)
    .single();

  if (connError || !connections) {
    console.error("❌ No Google connections found. Please connect a Google account first.");
    process.exit(1);
  }

  const orgId = connections.org_id;
  console.log(`✓ Found organization: ${orgId}`);
  console.log();

  // Step 2: Get a managed location
  console.log("Step 2: Finding managed location...");
  const { data: locations, error: locError } = await supabase
    .from("gbp_locations")
    .select("id, title, google_location_name")
    .eq("org_id", orgId)
    .eq("is_managed", true)
    .limit(1)
    .single();

  if (locError || !locations) {
    console.error("❌ No managed locations found. Please sync locations first.");
    process.exit(1);
  }

  console.log(`✓ Found location: ${locations.title} (${locations.id})`);
  console.log(`  Google Location: ${locations.google_location_name}`);
  console.log();

  // Step 3: Test sync posts endpoint
  console.log("Step 3: Testing sync posts endpoint...");
  console.log("POST /api/sync/posts");
  console.log();

  try {
    const syncResponse = await fetch("http://localhost:3000/api/sync/posts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orgId }),
    });

    const syncData = await syncResponse.json();

    if (syncResponse.ok) {
      console.log("✓ Sync successful!");
      console.log("Results:", JSON.stringify(syncData.results, null, 2));
      console.log();
    } else {
      console.error("❌ Sync failed:", syncData);
      console.log();
    }
  } catch (error) {
    console.error("❌ Error calling sync endpoint:", error);
    console.log();
  }

  // Step 4: Check synced posts in database
  console.log("Step 4: Checking synced posts in database...");
  const { data: posts, error: postsError } = await supabase
    .from("gbp_posts")
    .select("id, summary, topic_type, state, google_create_time")
    .eq("org_id", orgId)
    .limit(5);

  if (postsError) {
    console.error("❌ Error fetching posts:", postsError);
  } else {
    console.log(`✓ Found ${posts?.length || 0} posts in database`);
    if (posts && posts.length > 0) {
      console.log("\nSample posts:");
      posts.forEach((post, i) => {
        console.log(`  ${i + 1}. ${post.topic_type} - ${post.summary?.substring(0, 50)}...`);
        console.log(`     State: ${post.state}, Created: ${post.google_create_time}`);
      });
    }
    console.log();
  }

  // Step 5: Test create post endpoint
  console.log("Step 5: Testing create post endpoint...");
  console.log("POST /api/posts/create");
  console.log();

  const testPost = {
    locationId: locations.id,
    summary: `Test post from LocalSpotlight API - ${new Date().toLocaleString()}. This is a test to verify our Google Business Profile integration is working correctly!`,
    topicType: "STANDARD",
    callToAction: {
      actionType: "LEARN_MORE",
      url: "https://localspotlight.app",
    },
  };

  console.log("Post data:", JSON.stringify(testPost, null, 2));
  console.log();

  try {
    const createResponse = await fetch("http://localhost:3000/api/posts/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testPost),
    });

    const createData = await createResponse.json();

    if (createResponse.ok) {
      console.log("✓ Post created successfully!");
      console.log("Response:", JSON.stringify(createData, null, 2));
      console.log();

      if (createData.post?.searchUrl) {
        console.log(`🔗 View post: ${createData.post.searchUrl}`);
        console.log();
      }
    } else {
      console.error("❌ Post creation failed:", createData);
      console.log();
    }
  } catch (error) {
    console.error("❌ Error calling create endpoint:", error);
    console.log();
  }

  // Step 6: Verify the created post is in database
  console.log("Step 6: Verifying post in database...");
  const { data: latestPosts, error: latestError } = await supabase
    .from("gbp_posts")
    .select("id, summary, topic_type, state, google_create_time")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(3);

  if (latestError) {
    console.error("❌ Error fetching latest posts:", latestError);
  } else {
    console.log(`✓ Latest posts in database:`);
    latestPosts?.forEach((post, i) => {
      console.log(`  ${i + 1}. ${post.topic_type} - ${post.summary?.substring(0, 50)}...`);
      console.log(`     State: ${post.state}, Created: ${post.google_create_time}`);
    });
    console.log();
  }

  console.log("=".repeat(80));
  console.log("Test completed!");
  console.log("=".repeat(80));
}

// Run the test
testPostsAPI().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
