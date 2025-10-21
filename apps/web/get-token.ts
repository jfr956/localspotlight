import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { decryptRefreshToken } from './src/lib/encryption';

async function getToken() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: conn } = await supabase
    .from('connections_google')
    .select('*')
    .eq('org_id', 'a684026d-5676-48f8-a249-a5bd662f8552')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!conn) {
    console.error('No connection found');
    process.exit(1);
  }

  const refreshToken = decryptRefreshToken(conn.refresh_token_enc);
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { token } = await oauth2Client.getAccessToken();

  console.log(token);
}

getToken();
