/**
 * Test script for the post publishing workflow
 * This can be run to verify the entire system works end-to-end
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testPublishingWorkflow() {
  console.log('🧪 Testing post publishing workflow...\n')

  try {
    // 1. Check if there are any pending schedules
    console.log('1️⃣ Checking for pending schedules...')
    const { data: pendingSchedules, error: schedulesError } = await supabase
      .from('schedules')
      .select('*')
      .eq('status', 'pending')
      .eq('target_type', 'post_candidate')
      .lte('publish_at', new Date().toISOString())
      .limit(5)

    if (schedulesError) {
      console.error('❌ Failed to fetch schedules:', schedulesError)
      return
    }

    console.log(`✅ Found ${pendingSchedules?.length || 0} pending schedules`)

    if (!pendingSchedules || pendingSchedules.length === 0) {
      console.log('ℹ️ No pending schedules to test. Creating a test schedule...')
      
      // Create a test schedule if none exist
      const { data: locations, error: locationsError } = await supabase
        .from('gbp_locations')
        .select('*')
        .eq('is_managed', true)
        .limit(1)

      if (locationsError || !locations || locations.length === 0) {
        console.error('❌ No managed locations found for testing')
        return
      }

      const location = locations[0]

      // Create a test post candidate
      const { data: postCandidate, error: candidateError } = await supabase
        .from('post_candidates')
        .insert({
          org_id: location.org_id,
          location_id: location.id,
          schema: {
            type: 'WHATS_NEW',
            description: 'Test post for publishing workflow',
            source: 'test',
            createdAt: new Date().toISOString(),
            authorId: 'test-user'
          },
          images: [],
          status: 'pending'
        })
        .select('id')
        .single()

      if (candidateError || !postCandidate) {
        console.error('❌ Failed to create test post candidate:', candidateError)
        return
      }

      // Create a test schedule
      const { error: scheduleError } = await supabase
        .from('schedules')
        .insert({
          org_id: location.org_id,
          location_id: location.id,
          target_type: 'post_candidate',
          target_id: postCandidate.id,
          publish_at: new Date().toISOString(),
          status: 'pending'
        })

      if (scheduleError) {
        console.error('❌ Failed to create test schedule:', scheduleError)
        return
      }

      console.log('✅ Created test schedule')
    }

    // 2. Test the Edge Function directly
    console.log('\n2️⃣ Testing Edge Function...')
    const edgeFunctionUrl = `${supabaseUrl.replace('/rest/v1', '')}/functions/v1/publish-posts`
    const cronSecret = process.env.PUBLISH_POSTS_CRON_SECRET

    if (!cronSecret) {
      console.error('❌ PUBLISH_POSTS_CRON_SECRET not set')
      return
    }

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('❌ Edge Function failed:', error)
      return
    }

    const result = await response.json()
    console.log('✅ Edge Function executed successfully:', result)

    // 3. Check the results
    console.log('\n3️⃣ Checking results...')
    const { data: updatedSchedules, error: updatedError } = await supabase
      .from('schedules')
      .select('*')
      .eq('status', 'published')
      .limit(5)

    if (updatedError) {
      console.error('❌ Failed to fetch updated schedules:', updatedError)
    } else {
      console.log(`✅ Found ${updatedSchedules?.length || 0} published schedules`)
    }

    // 4. Check gbp_posts table
    const { data: gbpPosts, error: gbpError } = await supabase
      .from('gbp_posts')
      .select('*')
      .limit(5)

    if (gbpError) {
      console.error('❌ Failed to fetch GBP posts:', gbpError)
    } else {
      console.log(`✅ Found ${gbpPosts?.length || 0} posts in gbp_posts table`)
    }

    // 5. Check audit logs
    const { data: auditLogs, error: auditError } = await supabase
      .from('audit_logs')
      .select('*')
      .in('action', ['post_published', 'post_publish_failed'])
      .limit(5)

    if (auditError) {
      console.error('❌ Failed to fetch audit logs:', auditError)
    } else {
      console.log(`✅ Found ${auditLogs?.length || 0} relevant audit logs`)
    }

    console.log('\n✅ Publishing workflow test completed!')

  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

// Run the test
testPublishingWorkflow()