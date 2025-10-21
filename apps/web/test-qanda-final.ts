import * as dotenv from "dotenv";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { decryptRefreshToken } from "./src/lib/encryption";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, ".env.local") });

const ORG_ID = "a684026d-5676-48f8-a249-a5bd662f8552";
const LOCATION_NAME = "locations/16919135625305195332"; // Texas Lone Star AC & Heating LLC

async function testActualAPIs() {
  console.log("=== TESTING ACTUAL GBP DATA SYNC ===\n");

  // Initialize Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get connection
  const { data: connections } = await supabase
    .from("connections_google")
    .select("*")
    .eq("org_id", ORG_ID);

  if (!connections || connections.length === 0) {
    console.error("No connections found");
    process.exit(1);
  }

  const connection = connections[0];
  const refreshToken = decryptRefreshToken(connection.refresh_token_enc);

  // Set up OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({ refresh_token: refreshToken });

  console.log("Testing Reviews API v4...\n");
  console.log(`URL: https://mybusiness.googleapis.com/v4/${LOCATION_NAME}/reviews`);

  try {
    const response = await oauth2Client.request({
      url: `https://mybusiness.googleapis.com/v4/${LOCATION_NAME}/reviews?pageSize=50`,
      method: "GET",
    });

    console.log("✓ SUCCESS! Reviews API is working for your account!");
    console.log(`Status: ${response.status}`);
    const data = response.data as any;
    console.log(`Reviews found: ${data.reviews?.length || 0}`);
    console.log(`Average rating: ${data.averageRating || 'N/A'}`);
    console.log(`Total review count: ${data.totalReviewCount || 0}`);

    if (data.reviews && data.reviews.length > 0) {
      console.log("\nFirst review sample:");
      const review = data.reviews[0];
      console.log(`  - Rating: ${review.starRating}`);
      console.log(`  - Author: ${review.reviewer?.displayName || 'Anonymous'}`);
      console.log(`  - Comment: ${review.comment?.substring(0, 100) || 'No comment'}...`);
      console.log(`  - Date: ${review.createTime}`);
    }
  } catch (error: any) {
    console.error("✗ Reviews API Error");
    console.error(`Status: ${error.response?.status}`);
    console.error(`Message: ${error.message}`);
    if (error.response?.data) {
      console.error("Response:", JSON.stringify(error.response.data, null, 2));
    }
  }

  console.log("\n" + "=".repeat(50) + "\n");
  console.log("Testing Posts API v4...\n");
  console.log(`URL: https://mybusiness.googleapis.com/v4/${LOCATION_NAME}/localPosts`);

  try {
    const response = await oauth2Client.request({
      url: `https://mybusiness.googleapis.com/v4/${LOCATION_NAME}/localPosts?pageSize=50`,
      method: "GET",
    });

    console.log("✓ SUCCESS! Posts API is working for your account!");
    console.log(`Status: ${response.status}`);
    const data = response.data as any;
    console.log(`Posts found: ${data.localPosts?.length || 0}`);

    if (data.localPosts && data.localPosts.length > 0) {
      console.log("\nFirst post sample:");
      const post = data.localPosts[0];
      console.log(`  - Topic: ${post.topicType}`);
      console.log(`  - Summary: ${post.summary?.substring(0, 100) || 'No summary'}...`);
      console.log(`  - CTA: ${post.callToAction?.actionType || 'None'}`);
      console.log(`  - Date: ${post.createTime}`);
    }
  } catch (error: any) {
    console.error("✗ Posts API Error");
    console.error(`Status: ${error.response?.status}`);
    console.error(`Message: ${error.message}`);
    if (error.response?.data) {
      console.error("Response:", JSON.stringify(error.response.data, null, 2));
    }
  }

  console.log("\n" + "=".repeat(50) + "\n");
  console.log("Testing Q&A API v1...\n");
  console.log(`URL: https://mybusinessqanda.googleapis.com/v1/${LOCATION_NAME}/questions`);

  try {
    const response = await oauth2Client.request({
      url: `https://mybusinessqanda.googleapis.com/v1/${LOCATION_NAME}/questions`,
      method: "GET",
    });

    console.log("✓ SUCCESS! Q&A API is working!");
    console.log(`Status: ${response.status}`);
    const data = response.data as any;
    console.log(`Questions found: ${data.questions?.length || 0}`);

    if (data.questions && data.questions.length > 0) {
      console.log("\nFirst question sample:");
      const q = data.questions[0];
      console.log(`  - Question: ${q.text?.substring(0, 100)}...`);
      console.log(`  - Author: ${q.author?.displayName || 'Anonymous'}`);
      console.log(`  - Answers: ${q.topAnswers?.length || 0}`);
      if (q.topAnswers && q.topAnswers.length > 0) {
        console.log(`  - Top Answer: ${q.topAnswers[0].text?.substring(0, 100)}...`);
      }
    }
  } catch (error: any) {
    console.error("✗ Q&A API Error");
    console.error(`Status: ${error.response?.status}`);
    console.error(`Message: ${error.message}`);
    if (error.response?.data) {
      console.error("Response:", JSON.stringify(error.response.data, null, 2));
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("\nCONCLUSION:");
  console.log("If you see 404 errors above, those APIs are not available for your account.");
  console.log("If you see 403 errors, the APIs need to be enabled in Google Cloud Console.");
  console.log("If you see SUCCESS messages with data, the sync should work!");
}

testActualAPIs().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
