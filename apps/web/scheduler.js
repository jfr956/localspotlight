#!/usr/bin/env node
/**
 * Post Publishing Scheduler
 *
 * This script runs continuously and publishes posts at their exact scheduled time.
 * It checks the database every 10 seconds for posts that are due to be published.
 */

const https = require('https');
const http = require('http');

// Configuration from environment
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CHECK_INTERVAL_MS = 10000; // Check every 10 seconds

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

console.log('=== Post Publishing Scheduler Started ===');
console.log(`Supabase URL: ${SUPABASE_URL}`);
console.log(`Check interval: ${CHECK_INTERVAL_MS / 1000} seconds`);
console.log('');

/**
 * Fetch posts that are due to be published
 */
async function getDuePosts() {
  const url = new URL('/rest/v1/schedules', SUPABASE_URL);
  url.searchParams.set('status', 'eq.pending');
  url.searchParams.set('publish_at', `lte.${new Date().toISOString()}`);
  url.searchParams.set('select', 'id,target_id,target_type,publish_at');

  return new Promise((resolve, reject) => {
    const protocol = url.protocol === 'https:' ? https : http;
    const req = protocol.get(url, {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Failed to fetch due posts: ${res.statusCode} ${data}`));
        }
      });
    });
    req.on('error', reject);
  });
}

/**
 * Trigger the publish-posts edge function
 */
async function triggerPublish() {
  const url = new URL('/functions/v1/publish-posts', SUPABASE_URL);

  return new Promise((resolve, reject) => {
    const protocol = url.protocol === 'https:' ? https : http;
    const postData = JSON.stringify({});

    const req = protocol.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Failed to trigger publish: ${res.statusCode} ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Main scheduling loop
 */
async function checkAndPublish() {
  try {
    const duePosts = await getDuePosts();

    if (duePosts.length > 0) {
      const now = new Date().toISOString();
      console.log(`[${now}] Found ${duePosts.length} post(s) due for publishing:`);

      duePosts.forEach(post => {
        console.log(`  - Schedule ID: ${post.id}`);
        console.log(`    Target: ${post.target_type} ${post.target_id}`);
        console.log(`    Scheduled for: ${post.publish_at}`);
      });

      console.log('  Triggering publish-posts edge function...');
      const result = await triggerPublish();
      console.log(`  ✓ Result: processed=${result.processed}, published=${result.published}, failed=${result.failed}`);

      if (result.results && result.results.length > 0) {
        result.results.forEach(r => {
          if (r.success) {
            console.log(`    ✓ ${r.scheduleId}: Published successfully`);
          } else {
            console.log(`    ✗ ${r.scheduleId}: ${r.error}`);
          }
        });
      }
      console.log('');
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error:`, error.message);
  }
}

// Run check immediately on start
checkAndPublish();

// Then run on interval
setInterval(checkAndPublish, CHECK_INTERVAL_MS);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n=== Scheduler Stopped ===');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n=== Scheduler Stopped ===');
  process.exit(0);
});
