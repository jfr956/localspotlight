/**
 * Test script for syncReviewsAndQAAction
 *
 * This script tests the end-to-end sync action to verify:
 * 1. OAuth token decryption works
 * 2. Google API calls succeed
 * 3. Data is properly transformed and inserted
 * 4. Database records are created
 *
 * IMPORTANT: Run with environment variables loaded:
 * NODE_OPTIONS='--require dotenv/config' DOTENV_CONFIG_PATH=.env.local tsx test-sync-action.ts
 */

import { syncReviewsAndQAAction } from "./src/app/(dashboard)/integrations/google/server-actions";

const ORG_ID = "a684026d-5676-48f8-a249-a5bd662f8552";

async function testSyncAction() {
  console.log("========================================");
  console.log("TEST: syncReviewsAndQAAction");
  console.log("========================================");

  // Verify env vars are loaded
  console.log("\nEnvironment variables:");
  console.log("  NEXT_PUBLIC_SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log("  NEXT_PUBLIC_SUPABASE_ANON_KEY:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "✓ Set" : "✗ Missing");
  console.log("  SUPABASE_SERVICE_ROLE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "✓ Set" : "✗ Missing");
  console.log("  GOOGLE_REFRESH_TOKEN_SECRET:", process.env.GOOGLE_REFRESH_TOKEN_SECRET ? "✓ Set" : "✗ Missing");

  console.log(`\nTesting with Org ID: ${ORG_ID}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  // Create FormData with orgId
  const formData = new FormData();
  formData.append("orgId", ORG_ID);

  console.log("FormData created:", {
    orgId: formData.get("orgId"),
  });

  try {
    console.log("\n[TEST] Calling syncReviewsAndQAAction...\n");

    // Call the server action
    const result = await syncReviewsAndQAAction(formData);

    // If we get here, something unexpected happened (no redirect)
    console.log("\n[TEST] ⚠️  Action completed without redirect");
    console.log("[TEST] Result:", result);

  } catch (error: unknown) {
    // Next.js server actions throw special errors for redirects
    // Check if this is a redirect (expected behavior)
    if (error && typeof error === "object" && "digest" in error) {
      const digest = (error as { digest?: string }).digest;

      if (digest && digest.startsWith("NEXT_REDIRECT")) {
        console.log("\n[TEST] ✓ Redirect detected (expected behavior)");
        console.log("[TEST] Redirect digest:", digest);

        // Parse the redirect URL from the digest
        // Format is typically: NEXT_REDIRECT;replace;/path?params
        const parts = digest.split(";");
        if (parts.length >= 3) {
          const redirectUrl = parts[2];
          console.log("[TEST] Redirect URL:", redirectUrl);

          // Extract status from query params
          const urlObj = new URL(redirectUrl, "http://localhost:3000");
          const status = urlObj.searchParams.get("status");
          const orgId = urlObj.searchParams.get("orgId");

          console.log("\n[TEST] Redirect Details:");
          console.log("  - Status:", status);
          console.log("  - Org ID:", orgId);

          // Interpret the status
          console.log("\n[TEST] Status Interpretation:");
          switch (status) {
            case "content_synced":
              console.log("  ✓ SUCCESS: Content was successfully synced!");
              break;
            case "api_access_pending":
              console.log("  ⚠️  WARNING: No content synced - API access may be pending");
              console.log("     This means the OAuth connection works but API returned no data");
              break;
            case "sync_failed":
              console.log("  ✗ ERROR: Sync failed - check server logs for details");
              break;
            case "no_locations":
              console.log("  ⚠️  WARNING: No managed locations found");
              break;
            case "no_connections":
              console.log("  ✗ ERROR: No Google connections found");
              break;
            case "not_owner":
              console.log("  ✗ ERROR: User is not owner/admin");
              break;
            case "missing_org":
              console.log("  ✗ ERROR: Missing org ID");
              break;
            default:
              console.log(`  ❓ Unknown status: ${status}`);
          }
        }
      } else {
        console.log("\n[TEST] ✗ Unexpected error (not a redirect)");
        console.log("[TEST] Error digest:", digest);
        console.log("[TEST] Full error:", error);
      }
    } else {
      // Some other error
      console.log("\n[TEST] ✗ Unexpected error:");
      console.log("[TEST] Error type:", error?.constructor?.name);
      console.log("[TEST] Error message:", error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        console.log("[TEST] Stack trace:", error.stack);
      }
    }
  }

  console.log("\n========================================");
  console.log("TEST COMPLETE");
  console.log("========================================");
  console.log("\nNext steps:");
  console.log("1. Check the server logs above for detailed sync information");
  console.log("2. Run database query to verify data was inserted:");
  console.log(`   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT COUNT(*) FROM gbp_qna WHERE org_id = '${ORG_ID}'"`);
  console.log(`   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT COUNT(*) FROM gbp_reviews WHERE org_id = '${ORG_ID}'"`);
  console.log(`   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT COUNT(*) FROM gbp_posts WHERE org_id = '${ORG_ID}'"`);
  console.log("\n3. View the actual data:");
  console.log(`   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT question, answer FROM gbp_qna WHERE org_id = '${ORG_ID}' LIMIT 5"`);
}

// Run the test
testSyncAction().catch((error) => {
  console.error("\n[TEST] FATAL ERROR:");
  console.error(error);
  process.exit(1);
});
