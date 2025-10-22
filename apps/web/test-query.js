#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });

const http = require('http');
const https = require('https');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Testing scheduler query...');
console.log(`Supabase URL: ${SUPABASE_URL}`);
console.log(`Has anon key: ${!!SUPABASE_ANON_KEY}`);
console.log('');

const url = new URL('/rest/v1/schedules', SUPABASE_URL);
url.searchParams.set('status', 'eq.pending');
url.searchParams.set('publish_at', `lte.${new Date().toISOString()}`);
url.searchParams.set('select', 'id,target_id,target_type,publish_at');

console.log(`Query URL: ${url}`);
console.log('');

const protocol = url.protocol === 'https:' ? https : http;
const req = protocol.get(url, {
  headers: {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log('Response:', JSON.parse(data));
  });
});
req.on('error', err => console.error('Error:', err));
