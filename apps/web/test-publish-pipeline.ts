import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { decryptRefreshToken } from './src/lib/encryption';

const WORKING_ORG_ID = 'efd2615e-998b-4b70-83e0-0800c7cffc5a';
const WORKING_LOCATION_ID = '34dee80b-b958-44c3-bd80-b998ae587fa2'; // Texas Lone Star AC & Heating

async function testPublishPipeline() {
  console.log('=== POST PUBLISHING PIPELINE TEST ===\n');

  // Step 1: Verify environment variables
  console.log('Step 1: Checking environment variables...');
  console.log(`  SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
  console.log(`  GOOGLE_CLIENT_ID: ${process.env.GOOGLE_CLIENT_ID?.substring(0, 20)}...`);
  console.log(`  GOOGLE_REFRESH_TOKEN_SECRET: ${process.env.GOOGLE_REFRESH_TOKEN_SECRET}`);
  console.log('');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Step 2: Verify database connection
  console.log('Step 2: Verifying database connection...');
  const { data: orgs, error: orgsError } = await supabase
    .from('orgs')
    .select('id, name')
    .eq('id', WORKING_ORG_ID)
    .single();

  if (orgsError || !orgs) {
    console.error('❌ Failed to connect to database:', orgsError);
    return;
  }
  console.log(`  ✓ Connected to database, found org: ${orgs.name}`);
  console.log('');

  // Step 3: Get Google connection
  console.log('Step 3: Checking Google connection...');
  const { data: connection, error: connError } = await supabase
    .from('connections_google')
    .select('*')
    .eq('org_id', WORKING_ORG_ID)
    .limit(1)
    .single();

  if (connError || !connection) {
    console.error('❌ No Google connection found:', connError);
    return;
  }
  console.log(`  ✓ Found connection for account: ${connection.account_id}`);
  console.log(`  Token preview: ${connection.refresh_token_enc.substring(0, 30)}...`);

  // Step 3a: Test decryption
  try {
    const decrypted = decryptRefreshToken(connection.refresh_token_enc);
    console.log(`  ✓ Token decryption successful (length: ${decrypted.length})`);
  } catch (error: any) {
    console.error(`  ❌ Token decryption failed: ${error.message}`);
    return;
  }
  console.log('');

  // Step 4: Get location details
  console.log('Step 4: Checking location...');
  const { data: location, error: locError } = await supabase
    .from('gbp_locations')
    .select('*')
    .eq('id', WORKING_LOCATION_ID)
    .single();

  if (locError || !location) {
    console.error('❌ Location not found:', locError);
    return;
  }
  console.log(`  ✓ Found location: ${location.title}`);
  console.log(`  Google name: ${location.google_location_name}`);
  console.log('');

  // Step 5: Get or create a post candidate
  console.log('Step 5: Finding post candidate...');
  let { data: candidate, error: candError } = await supabase
    .from('post_candidates')
    .select('*')
    .eq('org_id', WORKING_ORG_ID)
    .eq('location_id', WORKING_LOCATION_ID)
    .eq('status', 'pending')
    .limit(1)
    .single();

  if (!candidate) {
    console.log('  No pending candidate found, checking approved...');
    const { data: approvedCandidate } = await supabase
      .from('post_candidates')
      .select('*')
      .eq('org_id', WORKING_ORG_ID)
      .eq('location_id', WORKING_LOCATION_ID)
      .eq('status', 'approved')
      .limit(1)
      .single();

    if (!approvedCandidate) {
      console.log('  Creating new test post candidate...');
      const newCandidate = {
        org_id: WORKING_ORG_ID,
        location_id: WORKING_LOCATION_ID,
        schema: {
          type: 'WHATS_NEW',
          title: 'Test Post',
          description: 'This is a test post created by the publish pipeline test.',
          cta: {
            action: 'LEARN_MORE',
            url: 'https://www.txlonestaracandheating.com'
          }
        },
        images: [],
        status: 'approved'
      };

      const { data: created, error: createError } = await supabase
        .from('post_candidates')
        .insert(newCandidate)
        .select()
        .single();

      if (createError || !created) {
        console.error('❌ Failed to create candidate:', createError);
        return;
      }
      candidate = created;
      console.log(`  ✓ Created new candidate: ${candidate.id}`);
    } else {
      candidate = approvedCandidate;
      console.log(`  ✓ Using approved candidate: ${candidate.id}`);
    }
  } else {
    console.log(`  ✓ Found pending candidate: ${candidate.id}`);
  }
  console.log('');

  // Step 6: Get or create schedule
  console.log('Step 6: Creating schedule...');

  // First, clean up any old test schedules
  await supabase
    .from('schedules')
    .delete()
    .eq('target_id', candidate.id);

  // Create a new schedule due NOW
  const scheduleData = {
    org_id: WORKING_ORG_ID,
    location_id: WORKING_LOCATION_ID,
    target_type: 'post_candidate',
    target_id: candidate.id,
    publish_at: new Date(Date.now() - 1000).toISOString(), // 1 second ago
    status: 'pending'
  };

  const { data: schedule, error: scheduleError } = await supabase
    .from('schedules')
    .insert(scheduleData)
    .select()
    .single();

  if (scheduleError || !schedule) {
    console.error('❌ Failed to create schedule:', scheduleError);
    return;
  }
  console.log(`  ✓ Created schedule: ${schedule.id}`);
  console.log(`  Publish at: ${schedule.publish_at}`);
  console.log('');

  // Step 7: Trigger the edge function
  console.log('Step 7: Triggering edge function...');
  console.log('  Calling: http://127.0.0.1:54321/functions/v1/publish-posts');

  try {
    const response = await fetch('http://127.0.0.1:54321/functions/v1/publish-posts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    console.log('  Response status:', response.status);
    console.log('  Response body:', JSON.stringify(result, null, 2));
    console.log('');

    // Step 8: Check schedule status
    console.log('Step 8: Checking schedule status...');
    const { data: updatedSchedule } = await supabase
      .from('schedules')
      .select('*')
      .eq('id', schedule.id)
      .single();

    if (updatedSchedule) {
      console.log(`  Status: ${updatedSchedule.status}`);
      console.log(`  Last error: ${updatedSchedule.last_error || 'none'}`);
      console.log(`  Retry count: ${updatedSchedule.retry_count || 0}`);
      console.log(`  Provider ref: ${updatedSchedule.provider_ref || 'none'}`);
      if (updatedSchedule.meta) {
        console.log(`  Meta:`, JSON.stringify(updatedSchedule.meta, null, 2));
      }
    }
    console.log('');

    // Step 9: Check audit logs
    console.log('Step 9: Checking audit logs...');
    const { data: logs } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('org_id', WORKING_ORG_ID)
      .order('created_at', { ascending: false })
      .limit(5);

    if (logs && logs.length > 0) {
      logs.forEach((log, i) => {
        console.log(`  ${i + 1}. ${log.action} - ${log.created_at}`);
        if (log.meta) {
          console.log(`     Meta:`, JSON.stringify(log.meta, null, 2));
        }
      });
    } else {
      console.log('  No audit logs found');
    }

  } catch (error: any) {
    console.error('❌ Edge function call failed:', error.message);
  }

  console.log('\n=== TEST COMPLETE ===');
}

testPublishPipeline();
