import * as dotenv from "dotenv";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { decryptRefreshToken } from "./src/lib/encryption";

dotenv.config({ path: path.resolve(__dirname, ".env.local") });

const ORG_ID = "a684026d-5676-48f8-a249-a5bd662f8552";
const LOCATION_NAME = "locations/16919135625305195332";

async function testQA() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: connections } = await supabase
    .from("connections_google")
    .select("*")
    .eq("org_id", ORG_ID);

  const connection = connections![0];
  const refreshToken = decryptRefreshToken(connection.refresh_token_enc);

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const qanda = google.mybusinessqanda({ version: "v1", auth: oauth2Client });

  console.log("Test 1: Using readMask='*'");
  try {
    const response = await qanda.locations.questions.list({
      parent: LOCATION_NAME,
      readMask: "*",
    });
    console.log("SUCCESS with readMask='*'");
    console.log("Questions:", response.data.questions?.length || 0);
    if (response.data.questions && response.data.questions.length > 0) {
      console.log("First question fields:", Object.keys(response.data.questions[0]));
    }
  } catch (error: any) {
    console.log("FAILED with readMask='*'");
    console.log("Error:", error.message);
  }
}

testQA();
