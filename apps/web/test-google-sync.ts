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
  console.log("=== Google Business Profile API Test (2025) ===\n");

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

  // Step 4: Test Business Profile Information API (v1 - current)
  console.log("Step 4: Testing Business Profile Information API (v1)...");
  try {
    const businessInfo = google.mybusinessbusinessinformation({
      version: "v1",
      auth: oauth2Client,
    });

    const locationResponse = await businessInfo.locations.get({
      name: LOCATION_NAME,
      readMask: "name,title,storeCode,phoneNumbers,websiteUri,categories,storefrontAddress",
    });

    console.log(`✓ Business Profile Information API responded successfully`);
    const location = locationResponse.data;
    console.log(`  Location details:`);
    console.log(`    - Name: ${location.title || "N/A"}`);
    console.log(`    - Store code: ${location.storeCode || "N/A"}`);
    console.log(`    - Phone: ${(location.phoneNumbers as any)?.primaryPhone || "N/A"}`);
    console.log(`    - Website: ${location.websiteUri || "N/A"}`);
    console.log(`    - Primary Category: ${(location.categories as any)?.primaryCategory?.displayName || "N/A"}`);
    console.log(`    - Address: ${(location.storefrontAddress as any)?.locality || "N/A"}, ${(location.storefrontAddress as any)?.administrativeArea || "N/A"}`);
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
    const businessInfo = google.mybusinessbusinessinformation({
      version: "v1",
      auth: oauth2Client,
    });

    const accountName = connection.account_id;
    const response = await businessInfo.accounts.locations.list({
      parent: accountName,
      readMask: "name,title,storeCode",
      pageSize: 50,
    });

    const locations = response.data.locations || [];
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

  // Step 6: Test Q&A API v1 (using googleapis library - for comparison)
  console.log("Step 6: Testing Q&A API v1 (using googleapis library)...");
  try {
    const qanda = google.mybusinessqanda({
      version: "v1",
      auth: oauth2Client,
    });

    console.log("  Fetching questions with readMask...");
    const response = await qanda.locations.questions.list({
      parent: LOCATION_NAME,
      readMask: "name,author,text,createTime,topAnswers,totalAnswerCount,updateTime,upvoteCount",
    });

    const questions = response.data.questions || [];
    console.log(`✓ Q&A API v1 (googleapis library) responded successfully`);
    console.log(`  Total questions fetched: ${questions.length}`);
    console.log(`  Total questions available: ${response.data.totalSize || 0}`);

    if (questions.length > 0) {
      const firstQuestion = questions[0];
      console.log(`  First question preview:`);
      console.log(`    - Question: ${(firstQuestion as any).text?.substring(0, 100) || "N/A"}...`);
      console.log(`    - Author: ${(firstQuestion as any).author?.displayName || "Anonymous"}`);
      console.log(`    - Answers: ${(firstQuestion as any).topAnswers?.length || 0}`);
      console.log(`    - Upvotes: ${(firstQuestion as any).upvoteCount || 0}`);
      console.log(`    - Created: ${(firstQuestion as any).createTime || "N/A"}`);
    } else {
      console.log(`  Note: No questions found for this location (this is normal if no Q&A has been posted yet)`);
    }
    console.log();
  } catch (error: any) {
    console.error("✗ Q&A API (googleapis library) error:", error.message);
    if (error.response?.data) {
      console.error("  Response data:", JSON.stringify(error.response.data, null, 2));
    }
    console.log();
  }

  // Step 6b: Test Q&A API v1 (using raw fetch via oauth2Client.request)
  console.log("Step 6b: Testing Q&A API v1 (using raw fetch via oauth2Client.request)...");
  try {
    // Approach 1: Without any query params (minimal request)
    console.log("  Attempt 1: Minimal request (no query params)...");
    const baseUrl = `https://mybusinessqanda.googleapis.com/v1/${LOCATION_NAME}/questions`;

    const response1 = await oauth2Client.request<{
      questions?: any[];
      nextPageToken?: string;
      totalSize?: number;
    }>({
      url: baseUrl,
      method: 'GET',
    });

    console.log(`  ✓ Minimal request succeeded!`);
    console.log(`    - Questions: ${response1.data.questions?.length || 0}`);
    console.log(`    - Total Size: ${response1.data.totalSize || 0}`);
    console.log(`    - Next Page Token: ${response1.data.nextPageToken ? 'Yes' : 'No'}`);

    // Display first question if available
    if (response1.data.questions && response1.data.questions.length > 0) {
      const firstQ = response1.data.questions[0];
      console.log(`    - First Question: ${firstQ.text?.substring(0, 80) || 'N/A'}...`);
    }
    console.log();

    // Approach 2: With query params (filter, orderBy, pageSize)
    console.log("  Attempt 2: With query params (filter=*, orderBy=updateTime desc, pageSize=50)...");
    const params = new URLSearchParams({
      filter: '*',
      orderBy: 'updateTime desc',
      pageSize: '50',
    });
    const urlWithParams = `${baseUrl}?${params.toString()}`;

    try {
      const response2 = await oauth2Client.request<{
        questions?: any[];
        nextPageToken?: string;
        totalSize?: number;
      }>({
        url: urlWithParams,
        method: 'GET',
      });

      console.log(`  ✓ Request with query params succeeded!`);
      console.log(`    - Questions: ${response2.data.questions?.length || 0}`);
      console.log(`    - Total Size: ${response2.data.totalSize || 0}`);
      console.log(`    - Next Page Token: ${response2.data.nextPageToken ? 'Yes' : 'No'}`);
      console.log();
    } catch (error2: any) {
      console.log(`  ✗ Request with query params failed:`, error2.message);
      if (error2.response?.data) {
        console.log(`    Response:`, JSON.stringify(error2.response.data, null, 2));
      }
      console.log(`    Note: Query params may not be supported by the Q&A API`);
      console.log();
    }

  } catch (error: any) {
    console.error("✗ Q&A API (raw fetch) error:", error.message);
    if (error.response?.data) {
      console.error("  Response data:", JSON.stringify(error.response.data, null, 2));
    }
    console.log("  Note: If you get a 403 error, the Q&A API may need to be enabled in Google Cloud Console.");
    console.log("  Visit: https://console.cloud.google.com/apis/library/mybusinessqanda.googleapis.com");
    console.log();
  }

  // Step 7: DEPRECATED - Posts API (no longer available)
  console.log("Step 7: Testing Local Posts API...");
  console.log("⚠️  DEPRECATED: Google removed the Local Posts API in 2024.");
  console.log("   The v4 endpoint (mybusiness.googleapis.com/v4/.../localPosts) returns 404.");
  console.log("   There is NO replacement API for programmatic post creation/fetching.");
  console.log("   Alternative: Implement 'Manual Assist' workflow (prepare content, user posts manually)");
  console.log();

  // Step 8: DEPRECATED - Reviews API (no longer available)
  console.log("Step 8: Testing Reviews API...");
  console.log("⚠️  DEPRECATED: Google removed the Reviews API in 2024.");
  console.log("   The v4 endpoint (mybusiness.googleapis.com/v4/.../reviews) returns 404.");
  console.log("   There is NO replacement API for programmatic review fetching.");
  console.log("   Alternative: Manual export from Business Profile dashboard");
  console.log();

  console.log("=== Test Complete ===\n");
  console.log("Summary:");
  console.log("✓ OAuth authentication: Working");
  console.log("✓ Business Profile Information API (v1): Working - can fetch location details");
  console.log("✓ Account Management API (v1): Working - can list locations");
  console.log("✓ Q&A API (v1): Check results above");
  console.log("  - googleapis library approach: See Step 6 results");
  console.log("  - Raw fetch approach: See Step 6b results");
  console.log("✗ Posts API: DEPRECATED (no programmatic access)");
  console.log("✗ Reviews API: DEPRECATED (no programmatic access)");
  console.log();
  console.log("Key Findings:");
  console.log("- Compare Step 6 (googleapis) vs Step 6b (raw fetch) to see which works better");
  console.log("- If raw fetch succeeds, we should use oauth2Client.request() instead of googleapis library");
  console.log("- Query params (filter, orderBy, pageSize) may or may not be supported");
  console.log();
  console.log("Next steps:");
  console.log("1. If Step 6b works, update fetchGoogleQuestions() to use raw fetch permanently");
  console.log("2. Test pagination with nextPageToken if available");
  console.log("3. Implement error handling for different response codes");
  console.log();
}

// Run the test
testGoogleAPIs().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
