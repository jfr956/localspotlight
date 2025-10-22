import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// Small red square as base64 (100x100 px)
const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='

async function createTestPost() {
  console.log('Creating test post with base64 image...')
  
  // Create post candidate
  const { data: postCandidate, error: pcError } = await supabase
    .from('post_candidates')
    .insert({
      org_id: '00000002-0002-0002-0002-000000000002',
      location_id: '00000034-0034-0034-0034-000000000034',
      schema: {
        type: 'WHATS_NEW',
        headline: 'Base64 Test Post',
        body: 'Testing automatic base64 image conversion to Supabase Storage',
        cta: 'LEARN_MORE',
        link: 'https://www.txlonestaracandheating.com',
        riskScore: 0.1
      },
      images: [testImageBase64],
      status: 'approved'
    })
    .select()
    .single()

  if (pcError) throw pcError
  console.log('✓ Post candidate created:', postCandidate.id)

  // Schedule for immediate publish (30 seconds from now)
  const publishAt = new Date(Date.now() + 30000).toISOString()
  
  const { data: schedule, error: schedError } = await supabase
    .from('schedules')
    .insert({
      org_id: '00000002-0002-0002-0002-000000000002',
      location_id: '00000034-0034-0034-0034-000000000034',
      target_id: postCandidate.id,
      target_type: 'post_candidate',
      publish_at: publishAt,
      status: 'pending'
    })
    .select()
    .single()

  if (schedError) throw schedError
  console.log('✓ Schedule created:', schedule.id)
  console.log('  Scheduled for:', publishAt)
  console.log('\nWaiting for scheduler to publish (30 seconds)...')
}

createTestPost().catch(console.error)
