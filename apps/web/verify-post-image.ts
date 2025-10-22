import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { decryptRefreshToken } from './src/lib/encryption';

const GOOGLE_POST_NAME = 'accounts/102864608154197885581/locations/16919135625305195332/localPosts/7327019527969211603';

async function getAccessToken(refreshTokenEnc: string): Promise<string | null> {
  try {
    const refreshToken = decryptRefreshToken(refreshTokenEnc);

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });

    const data = await response.json();
    return data.access_token || null;
  } catch (error: any) {
    console.error('Failed to get access token:', error.message);
    return null;
  }
}

async function verifyPostImage() {
  console.log('=== VERIFY POST IMAGE UPLOAD ===\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get Google connection
  const { data: connection } = await supabase
    .from('connections_google')
    .select('*')
    .eq('org_id', 'efd2615e-998b-4b70-83e0-0800c7cffc5a')
    .limit(1)
    .single();

  if (!connection) {
    console.error('No connection found');
    return;
  }

  // Get access token
  const accessToken = await getAccessToken(connection.refresh_token_enc);
  if (!accessToken) {
    console.error('Failed to get access token');
    return;
  }

  console.log('Fetching post from Google API...');
  console.log(`Post name: ${GOOGLE_POST_NAME}\n`);

  // Fetch the post from Google API
  const response = await fetch(
    `https://mybusiness.googleapis.com/v4/${GOOGLE_POST_NAME}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!response.ok) {
    console.error(`API Error: ${response.status} ${response.statusText}`);
    const error = await response.text();
    console.error('Error details:', error);
    return;
  }

  const post = await response.json();
  console.log('Post data received from Google:\n');
  console.log(JSON.stringify(post, null, 2));

  // Check for media
  if (post.media && post.media.length > 0) {
    console.log(`\n✓ POST HAS ${post.media.length} MEDIA ITEM(S) UPLOADED!`);
    post.media.forEach((media: any, i: number) => {
      console.log(`\nMedia ${i + 1}:`);
      console.log(`  Type: ${media.mediaFormat}`);
      console.log(`  Name: ${media.name}`);
      if (media.sourceUrl) {
        console.log(`  Source URL: ${media.sourceUrl}`);
      }
      if (media.googleUrl) {
        console.log(`  Google URL: ${media.googleUrl}`);
      }
    });
  } else {
    console.log('\n❌ NO MEDIA FOUND ON POST');
  }

  console.log('\n=== VERIFICATION COMPLETE ===');
}

verifyPostImage();
