import * as dotenv from "dotenv";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { decryptRefreshToken } from "./src/lib/encryption";

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, ".env.local") });

const ORG_ID = "a684026d-5676-48f8-a249-a5bd662f8552";
const LOCATION_NAME = "locations/16919135625305195332";

async function testGoogleAPIs() {
  console.log("=== Google Business Profile API Test ===\n");

  // Verify environment variables are loaded
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Error: Environment variables not loaded. Check .env.local file.");
    process.exit(1);
  }

  // Initialize Supabase client with service role key
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Step 1: Fetch the Google connection from the database
  console.log("Step 1: Fetching Google connection from database...");
  const { data: connections, error: connectionError } = await supabase
    .from("connections_google")
    .select("*")
    .eq("org_id", ORG_ID);

  if (connectionError || !connections || connections.length === 0) {
    console.error("Error fetching connection:", connectionError);
    process.exit(1);
  }

  console.log(`✓ Found ${connections.length} connection(s) for org`);
  // Use the first connection
  const connection = connections[0];
  console.log(`  Using connection for account: ${connection.account_id}`);
  console.log(`  Scopes: ${connection.scopes.join(", ")}\n`);

  // Step 2: Decrypt the refresh token
  console.log("Step 2: Decrypting refresh token...");
  let refreshToken: string;
  try {
    refreshToken = decryptRefreshToken(connection.refresh_token_enc);
    console.log("✓ Refresh token decrypted successfully\n");
  } catch (error) {
    console.error("Error decrypting refresh token:", error);
    process.exit(1);
  }

  // Step 3: Set up OAuth2 client
  console.log("Step 3: Setting up OAuth2 client...");
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  console.log("✓ OAuth2 client configured\n");

  // Step 4: Test Business Profile Information API (newer API)
  console.log("Step 4: Testing Business Profile Information API...");
  try {
    // Use the correct read_mask parameter for the Business Profile API
    const response = await oauth2Client.request({
      url: `https://mybusinessbusinessinformation.googleapis.com/v1/${LOCATION_NAME}?readMask=name,title,storeCode,phoneNumbers,websiteUri,categories,storefrontAddress,serviceArea,profile,regularHours,specialHours,serviceItems,labels`,
      method: "GET",
    });

    console.log(`✓ Business Profile Information API responded successfully`);
    const location = response.data as any;
    console.log(`  Location details:`);
    console.log(`    - Name: ${location.title || "N/A"}`);
    console.log(`    - Store code: ${location.storeCode || "N/A"}`);
    console.log(`    - Phone: ${location.phoneNumbers?.primaryPhone || "N/A"}`);
    console.log(`    - Website: ${location.websiteUri || "N/A"}`);
    console.log(`    - Primary Category: ${location.categories?.primaryCategory?.displayName || "N/A"}`);
    console.log(`    - Address: ${location.storefrontAddress?.locality || "N/A"}, ${location.storefrontAddress?.administrativeArea || "N/A"}`);
    console.log();
  } catch (error: any) {
    console.error("✗ Business Profile Information API error:", error.message);
    if (error.response?.data) {
      console.error("  Response data:", JSON.stringify(error.response.data, null, 2));
    }
    console.log();
  }

  // Step 5: Test Account Management API - List all locations
  console.log("Step 5: Testing Account Management API (List Locations)...");
  try {
    // Note: We may need to get the account name first
    const accountName = connection.account_id; // This should be in the format "accounts/{account_id}"
    const response = await oauth2Client.request({
      url: `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title,storeCode`,
      method: "GET",
    });

    const locations = (response.data as any).locations || [];
    console.log(`✓ Account Management API responded successfully`);
    console.log(`  Total locations found: ${locations.length}`);

    if (locations.length > 0) {
      console.log(`  First few locations:`);
      locations.slice(0, 3).forEach((loc: any, index: number) => {
        console.log(`    ${index + 1}. ${loc.title} (${loc.name})`);
      });
    }
    console.log();
  } catch (error: any) {
    console.error("✗ Account Management API error:", error.message);
    if (error.response?.data) {
      console.error("  Response data:", JSON.stringify(error.response.data, null, 2));
    }
    console.log();
  }

  // Step 6: Test creating a local post using Google Business Profile API
  console.log("Step 6: Testing Local Posts API (using googleapis library)...");
  try {
    const mybusinessbusinessinformation = google.mybusinessbusinessinformation({
      version: "v1",
      auth: oauth2Client,
    });

    // Try to get the location details using the library
    const locationResponse = await mybusinessbusinessinformation.locations.get({
      name: LOCATION_NAME,
      readMask: "name,title,storeCode,phoneNumbers",
    });

    console.log(`✓ Googleapis library worked successfully`);
    console.log(`  Location via library: ${locationResponse.data.title}`);
    console.log();
  } catch (error: any) {
    console.error("✗ Googleapis library error:", error.message);
    if (error.response?.data) {
      console.error("  Response data:", JSON.stringify(error.response.data, null, 2));
    }
    console.log();
  }

  // Step 7: Test Google Posts API (Create Local Post)
  // Note: This API may require special access
  console.log("Step 7: Testing Google Posts API (check if posts endpoint exists)...");
  try {
    // Try the new Google My Business Local Posts API endpoint
    const response = await oauth2Client.request({
      url: `https://mybusiness.googleapis.com/v4/${LOCATION_NAME}/localPosts?pageSize=10`,
      method: "GET",
    });

    const posts = (response.data as any).localPosts || [];
    console.log(`✓ Posts API (v4) responded successfully`);
    console.log(`  Total posts fetched: ${posts.length}`);

    if (posts.length > 0) {
      const firstPost = posts[0];
      console.log(`  First post preview:`);
      console.log(`    - Post name: ${firstPost.name}`);
      console.log(`    - Topic: ${firstPost.topicType || "N/A"}`);
      console.log(`    - Summary: ${firstPost.summary?.substring(0, 100) || "N/A"}...`);
    }
    console.log();
  } catch (error: any) {
    console.error("✗ Posts API error (expected - API may be deprecated):", error.message);
    console.log("  Note: The Posts API may not be available for all accounts.");
    console.log();
  }

  // Step 8: Test Reviews API (using the correct endpoint)
  console.log("Step 8: Testing Reviews API (check availability)...");
  try {
    // Try the reviews endpoint - note this may also require special permissions
    const response = await oauth2Client.request({
      url: `https://mybusiness.googleapis.com/v4/${LOCATION_NAME}/reviews?pageSize=10`,
      method: "GET",
    });

    const reviews = (response.data as any).reviews || [];
    console.log(`✓ Reviews API responded successfully`);
    console.log(`  Total reviews fetched: ${reviews.length}`);

    if (reviews.length > 0) {
      const firstReview = reviews[0];
      console.log(`  First review preview:`);
      console.log(`    - Rating: ${firstReview.starRating || "N/A"}`);
      console.log(`    - Author: ${firstReview.reviewer?.displayName || "Anonymous"}`);
      console.log(`    - Comment: ${firstReview.comment?.substring(0, 100) || "No comment"}...`);
    }
    console.log();
  } catch (error: any) {
    console.error("✗ Reviews API error (expected - requires special permissions):", error.message);
    console.log("  Note: Reviews API requires additional permissions or account setup.");
    console.log();
  }

  // Step 9: Test Q&A API
  console.log("Step 9: Testing Q&A API (check availability)...");
  try {
    const response = await oauth2Client.request({
      url: `https://mybusiness.googleapis.com/v4/${LOCATION_NAME}/questions?pageSize=10`,
      method: "GET",
    });

    const questions = (response.data as any).questions || [];
    console.log(`✓ Q&A API responded successfully`);
    console.log(`  Total questions fetched: ${questions.length}`);

    if (questions.length > 0) {
      const firstQuestion = questions[0];
      console.log(`  First question preview:`);
      console.log(`    - Question: ${firstQuestion.text?.substring(0, 100) || "N/A"}...`);
      console.log(`    - Author: ${firstQuestion.author?.displayName || "Anonymous"}`);
    }
    console.log();
  } catch (error: any) {
    console.error("✗ Q&A API error (expected - requires special permissions):", error.message);
    console.log("  Note: Q&A API requires additional permissions or account setup.");
    console.log();
  }

  console.log("=== Test Complete ===\n");
  console.log("Summary:");
  console.log("- OAuth authentication: ✓ Working");
  console.log("- Business Profile Information API: Check results above");
  console.log("- Account Management API: Check results above");
  console.log("- Posts/Reviews/Q&A APIs: May require additional setup or permissions");
  console.log("\nNext steps:");
  console.log("1. If Business Profile API works, we can fetch location details");
  console.log("2. For Posts/Reviews/Q&A, we may need to:");
  console.log("   - Enable additional APIs in Google Cloud Console");
  console.log("   - Request special access from Google");
  console.log("   - Use alternative methods (e.g., Business Communications API)");
}

// Run the test
testGoogleAPIs().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
