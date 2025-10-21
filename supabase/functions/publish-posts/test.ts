// Test file for the publish-posts Edge Function
// This can be run locally to verify the function works

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Mock environment variables for testing
const mockEnv = {
  SUPABASE_URL: "http://localhost:54321",
  SUPABASE_SERVICE_ROLE_KEY: "test-key",
  PUBLISH_POSTS_CRON_SECRET: "test-secret",
  GOOGLE_CLIENT_ID: "test-client-id",
  GOOGLE_CLIENT_SECRET: "test-client-secret",
  GOOGLE_REFRESH_TOKEN_SECRET: "test-refresh-token-secret-that-is-long-enough"
}

// Set up mock Deno.env
for (const [key, value] of Object.entries(mockEnv)) {
  Deno.env.set(key, value)
}

// Import the main function
import { POST } from "./index.ts"

// Test request
const testRequest = new Request("http://localhost:9000", {
  method: "POST",
  headers: {
    "Authorization": "Bearer test-secret",
    "Content-Type": "application/json"
  }
})

// Run the test
async function runTest() {
  console.log("Testing publish-posts Edge Function...")
  
  try {
    const response = await POST(testRequest)
    const result = await response.json()
    
    console.log("Response status:", response.status)
    console.log("Response body:", result)
    
    if (response.status === 200) {
      console.log("✅ Test passed!")
    } else {
      console.log("❌ Test failed!")
    }
  } catch (error) {
    console.error("❌ Test error:", error)
  }
}

// Only run test if this file is executed directly
if (import.meta.main) {
  runTest()
}