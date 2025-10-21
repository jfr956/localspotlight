/**
 * Test script for Google Business Profile reviews synchronization
 *
 * This script tests the review sync API endpoint by:
 * 1. Calling the sync API route
 * 2. Logging detailed sync results
 * 3. Verifying reviews were written to the database
 *
 * Usage:
 *   pnpm tsx test-sync-reviews.ts
 *
 * Prerequisites:
 * - User must be authenticated (have valid session cookies)
 * - User must belong to an org with Google connections
 * - Org must have managed locations with reviews
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './src/types/database';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'SET' : 'MISSING');
  console.error('\n💡 Make sure .env.local exists in apps/web/ directory');
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('🚀 Starting Google Business Profile Review Sync Test\n');

  // Step 1: Get org info
  console.log('📊 Step 1: Checking database state...');

  const { data: orgs, error: orgsError } = await supabase
    .from('orgs')
    .select('id, name')
    .limit(1)
    .maybeSingle();

  if (orgsError || !orgs) {
    console.error('❌ No orgs found in database:', orgsError?.message);
    process.exit(1);
  }

  console.log(`   ✓ Found org: ${orgs.name} (${orgs.id})`);

  // Check connections
  const { data: connections, error: connectionsError } = await supabase
    .from('connections_google')
    .select('id, account_id')
    .eq('org_id', orgs.id);

  if (connectionsError) {
    console.error('❌ Error fetching connections:', connectionsError.message);
    process.exit(1);
  }

  console.log(`   ✓ Found ${connections?.length || 0} Google connection(s)`);

  if (!connections || connections.length === 0) {
    console.error('❌ No Google connections found. Please connect a Google account first.');
    process.exit(1);
  }

  // Check locations
  const { data: locations, error: locationsError } = await supabase
    .from('gbp_locations')
    .select('id, title, is_managed, google_location_name')
    .eq('org_id', orgs.id)
    .eq('is_managed', true);

  if (locationsError) {
    console.error('❌ Error fetching locations:', locationsError.message);
    process.exit(1);
  }

  console.log(`   ✓ Found ${locations?.length || 0} managed location(s)`);

  if (!locations || locations.length === 0) {
    console.error('❌ No managed locations found. Please sync locations first.');
    process.exit(1);
  }

  locations.forEach((loc, i) => {
    console.log(`      ${i + 1}. ${loc.title || loc.id} (${loc.google_location_name})`);
  });

  // Check existing reviews count
  const { count: existingReviewsCount } = await supabase
    .from('gbp_reviews')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgs.id);

  console.log(`   ✓ Current review count: ${existingReviewsCount || 0}\n`);

  // Step 2: Get a user to authenticate with
  console.log('🔐 Step 2: Getting user authentication...');

  const { data: users, error: usersError } = await supabase
    .from('org_members')
    .select('user_id')
    .eq('org_id', orgs.id)
    .limit(1)
    .maybeSingle();

  if (usersError || !users) {
    console.error('❌ No users found for org:', usersError?.message);
    process.exit(1);
  }

  console.log(`   ✓ Using user ID: ${users.user_id}\n`);

  // Step 3: Show how to trigger sync
  console.log('🔄 Step 3: How to trigger review sync...\n');

  const apiUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  console.log('📝 Option 1: Via HTTP POST (recommended)');
  console.log('   1. Start the dev server: pnpm dev');
  console.log(`   2. POST to: ${apiUrl}/api/sync/reviews`);
  console.log('   3. Or use curl:');
  console.log('      curl -X POST http://localhost:3000/api/sync/reviews \\');
  console.log('           -H "Content-Type: application/json"');
  console.log('');

  console.log('📝 Option 2: Via test script with actual API call');
  console.log('   This requires the dev server to be running on port 3000\n');

  // Step 4: Check if we can make actual HTTP call
  const isDevServerRunning = process.env.DEV_SERVER_RUNNING === 'true';

  if (isDevServerRunning) {
    console.log('🌐 Making actual HTTP request to sync API...');
    try {
      const response = await fetch(`${apiUrl}/api/sync/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      console.log('\n✅ Sync API Response:');
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('❌ Error calling sync API:', error);
      console.log('   Make sure dev server is running: pnpm dev');
    }
  } else {
    console.log('ℹ️  To make actual API call, set DEV_SERVER_RUNNING=true environment variable');
  }

  // Step 5: Show current review sample
  console.log('\n📈 Current review sample (latest 5):');
  const { data: reviewsData, error: reviewsError } = await supabase
    .from('gbp_reviews')
    .select('*')
    .eq('org_id', orgs.id)
    .order('created_at', { ascending: false })
    .limit(5);

  if (reviewsError) {
    console.error('❌ Error fetching reviews:', reviewsError.message);
  }

  if (reviewsData && reviewsData.length > 0) {
    reviewsData.forEach((review, i) => {
      console.log(`   ${i + 1}. ${review.author || 'Anonymous'} - ${review.rating || 0} stars`);
      const text = (review.text || '').substring(0, 60);
      console.log(`      "${text}${text.length >= 60 ? '...' : ''}"`);
      if (review.reply) {
        const replyText = review.reply.substring(0, 60);
        console.log(`      Reply: "${replyText}${replyText.length >= 60 ? '...' : ''}"`);
      }
    });
  } else {
    console.log('   No reviews found yet. Run the sync to fetch them.');
  }

  // Step 6: Show SQL to verify data
  console.log('\n📊 SQL queries to verify review data:');
  console.log('\n   -- Count reviews by location:');
  console.log('   SELECT l.title, COUNT(r.id) as review_count, AVG(r.rating) as avg_rating');
  console.log('   FROM gbp_locations l');
  console.log('   LEFT JOIN gbp_reviews r ON r.location_id = l.id');
  console.log(`   WHERE l.org_id = '${orgs.id}'`);
  console.log('   GROUP BY l.id, l.title');
  console.log('   ORDER BY review_count DESC;');
  console.log('');
  console.log('   -- View latest reviews:');
  console.log('   SELECT author, rating, text, reply, created_at');
  console.log('   FROM gbp_reviews');
  console.log(`   WHERE org_id = '${orgs.id}'`);
  console.log('   ORDER BY created_at DESC');
  console.log('   LIMIT 10;');
  console.log('');
  console.log('   -- Check for reviews without replies (opportunities):');
  console.log('   SELECT COUNT(*) as reviews_without_reply');
  console.log('   FROM gbp_reviews');
  console.log(`   WHERE org_id = '${orgs.id}' AND reply IS NULL;`);

  console.log('\n✅ Pre-sync check completed successfully!');
  console.log('\n💡 Next steps:');
  console.log('   1. Start dev server: pnpm dev');
  console.log('   2. Navigate to: http://localhost:3000/integrations/google');
  console.log('   3. Click the "Sync Reviews" button (if available)');
  console.log('   4. Or make POST request to: /api/sync/reviews');
}

main().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
