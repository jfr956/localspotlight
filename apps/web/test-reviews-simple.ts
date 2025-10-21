/**
 * Simple test to verify review sync prerequisites
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './src/types/database';

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('🚀 Review Sync Prerequisites Check\n');

  const { data: orgs } = await supabase.from('orgs').select('id, name').limit(1).maybeSingle();
  if (!orgs) {
    console.error('❌ No orgs found');
    process.exit(1);
  }

  console.log(`✓ Org: ${orgs.name}`);

  const { data: connections } = await supabase.from('connections_google').select('*').eq('org_id', orgs.id);
  console.log(`✓ Connections: ${connections?.length || 0}`);

  const { data: locations } = await supabase.from('gbp_locations').select('id, title, google_location_name').eq('org_id', orgs.id).eq('is_managed', true);
  console.log(`✓ Managed locations: ${locations?.length || 0}`);
  locations?.forEach((loc, i) => console.log(`  ${i + 1}. ${loc.title} (${loc.google_location_name})`));

  const { count } = await supabase.from('gbp_reviews').select('*', { count: 'exact', head: true }).eq('org_id', orgs.id);
  console.log(`✓ Current reviews: ${count || 0}`);

  const { data: reviews } = await supabase.from('gbp_reviews').select('*').eq('org_id', orgs.id).order('created_at', { ascending: false }).limit(3);

  if (reviews && reviews.length > 0) {
    console.log('\n📈 Sample reviews:');
    reviews.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.author} - ${r.rating} stars`);
      console.log(`     "${(r.text || '').substring(0, 50)}..."`);
    });
  }

  console.log('\n✅ Prerequisites check complete!');
  console.log('\n📝 To sync reviews:');
  console.log('   POST http://localhost:3000/api/sync/reviews');
  console.log('\n📊 Verify data with SQL:');
  console.log(`   SELECT COUNT(*) FROM gbp_reviews WHERE org_id = '${orgs.id}';`);
}

main().catch(console.error);
