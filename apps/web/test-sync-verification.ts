import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { fetchGoogleReviews } from './src/lib/google-business';
import { decryptRefreshToken } from './src/lib/encryption';

const ORG_ID = 'a684026d-5676-48f8-a249-a5bd662f8552';

async function testSyncForManagedLocations() {
  console.log('=== Testing Sync for Managed Locations ===\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get the refresh token
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

  // Get managed locations with their account info (simulating the server action query)
  const { data: locations, error: locError } = await supabase
    .from('gbp_locations')
    .select('id, google_location_name, title, account_id, gbp_accounts!inner(google_account_name)')
    .eq('org_id', ORG_ID)
    .eq('is_managed', true);

  if (locError) {
    console.error('Error fetching locations:', locError);
    process.exit(1);
  }

  console.log(`Found ${locations?.length || 0} managed locations\n`);

  for (const location of locations || []) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Location: ${location.title}`);
    console.log(`${'='.repeat(60)}`);

    // Extract account ID
    const accountRecord = Array.isArray(location.gbp_accounts)
      ? location.gbp_accounts[0]
      : location.gbp_accounts;

    const googleAccountName = accountRecord?.google_account_name;
    const accountMatch = googleAccountName?.match(/accounts\/([^/]+)/);
    const accountId = accountMatch?.[1];

    // Extract location ID
    const locationMatch = location.google_location_name?.match(/locations\/([^/]+)/);
    const locationId = locationMatch?.[1];

    console.log(`Account ID: ${accountId}`);
    console.log(`Location ID: ${locationId}`);
    console.log(`Full account name: ${googleAccountName}`);
    console.log(`Full location name: ${location.google_location_name}\n`);

    if (!accountId || !locationId) {
      console.log('❌ Could not extract IDs - skipping\n');
      continue;
    }

    // Test fetching reviews
    try {
      console.log('Testing fetchGoogleReviews...');
      const reviews = await fetchGoogleReviews(refreshToken, accountId, locationId);
      console.log(`✅ SUCCESS! Found ${reviews.length} reviews`);

      if (reviews.length > 0) {
        console.log('\nSample review:');
        console.log(`  - Author: ${reviews[0].reviewer?.displayName}`);
        console.log(`  - Rating: ${reviews[0].starRating}`);
        console.log(`  - Comment: ${reviews[0].comment?.substring(0, 100)}...`);
      }
    } catch (error: any) {
      console.log(`❌ FAILED: ${error.message}`);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Details: ${JSON.stringify(error.response.data, null, 2)}`);
      }
    }
  }
}

testSyncForManagedLocations();
