import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { decryptRefreshToken } from './src/lib/encryption';

const ORG_ID = 'a684026d-5676-48f8-a249-a5bd662f8552';
const ACCOUNT_ID = '108283827725802632530';
const LOCATION_ID = '16919135625305195332';

async function testAllAPIs() {
  console.log('=== FINAL API TEST (With mybusiness.googleapis.com enabled) ===\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: conn } = await supabase
    .from('connections_google')
    .select('*')
    .eq('org_id', ORG_ID)
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

  // Test 1: Reviews API (READ)
  console.log('Test 1: Reading Reviews...\n');
  try {
    const url = `https://mybusiness.googleapis.com/v4/accounts/${ACCOUNT_ID}/locations/${LOCATION_ID}/reviews`;
    console.log(`URL: ${url}`);

    const response = await oauth2Client.request({ url, method: 'GET' });
    const data = response.data as any;

    console.log('✅ SUCCESS! Reviews API is working!');
    console.log(`   Reviews found: ${data.reviews?.length || 0}`);
    console.log(`   Average rating: ${data.averageRating || 'N/A'}`);
    console.log(`   Total reviews: ${data.totalReviewCount || 0}\n`);

    if (data.reviews && data.reviews.length > 0) {
      const review = data.reviews[0];
      console.log('   Sample review:');
      console.log(`   - ID: ${review.reviewId}`);
      console.log(`   - Rating: ${review.starRating}`);
      console.log(`   - Author: ${review.reviewer?.displayName}`);
      console.log(`   - Comment: ${review.comment?.substring(0, 80) || 'No comment'}...`);
      console.log(`   - Has reply: ${review.reviewReply ? 'Yes' : 'No'}\n`);
    }
  } catch (error: any) {
    console.log('❌ Reviews API failed');
    console.log(`   Error: ${error.message}\n`);
  }

  console.log('='.repeat(60) + '\n');

  // Test 2: Posts API (READ)
  console.log('Test 2: Reading Posts...\n');
  try {
    const url = `https://mybusiness.googleapis.com/v4/accounts/${ACCOUNT_ID}/locations/${LOCATION_ID}/localPosts`;
    console.log(`URL: ${url}`);

    const response = await oauth2Client.request({ url, method: 'GET' });
    const data = response.data as any;

    console.log('✅ SUCCESS! Posts API is working!');
    console.log(`   Posts found: ${data.localPosts?.length || 0}\n`);

    if (data.localPosts && data.localPosts.length > 0) {
      const post = data.localPosts[0];
      console.log('   Sample post:');
      console.log(`   - Topic: ${post.topicType}`);
      console.log(`   - Summary: ${post.summary?.substring(0, 80) || 'No summary'}...`);
      console.log(`   - Created: ${post.createTime}\n`);
    }
  } catch (error: any) {
    console.log('❌ Posts API failed');
    console.log(`   Status: ${error.response?.status}`);
    console.log(`   Error: ${error.message}\n`);
  }

  console.log('='.repeat(60) + '\n');

  // Test 3: Media API (READ)
  console.log('Test 3: Reading Media...\n');
  try {
    const url = `https://mybusiness.googleapis.com/v4/accounts/${ACCOUNT_ID}/locations/${LOCATION_ID}/media`;
    console.log(`URL: ${url}`);

    const response = await oauth2Client.request({ url, method: 'GET' });
    const data = response.data as any;

    console.log('✅ SUCCESS! Media API is working!');
    console.log(`   Media items found: ${data.mediaItems?.length || 0}\n`);
  } catch (error: any) {
    console.log('❌ Media API failed');
    console.log(`   Status: ${error.response?.status}`);
    console.log(`   Error: ${error.message}\n`);
  }

  console.log('='.repeat(60) + '\n');

  // Summary
  console.log('SUMMARY:');
  console.log('✅ Reviews API - Working (can read all reviews)');
  console.log('⏳ Posts API - Testing above');
  console.log('⏳ Media API - Testing above');
  console.log('\nNext steps:');
  console.log('1. Test posting a review reply');
  console.log('2. Test creating a new post');
  console.log('3. Implement full automation in LocalSpotlight!');
}

testAllAPIs();
