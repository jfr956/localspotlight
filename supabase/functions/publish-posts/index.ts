import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { decryptRefreshToken } from "./encryption.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PostCandidate {
  id: string
  org_id: string
  location_id: string
  schema: Record<string, any>
  images: string[]
  status: string
}

interface Schedule {
  id: string
  org_id: string
  location_id: string
  target_type: string
  target_id: string
  publish_at: string
  status: string
}

interface GoogleConnection {
  account_id: string
  refresh_token_enc: string
  scopes: string[]
}

interface GbpLocation {
  id: string
  org_id: string
  account_id: string
  google_location_name: string
  meta: Record<string, any>
}

interface PublishResult {
  scheduleId: string
  success: boolean
  error?: string
  googlePostName?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization')
    const cronSecret = Deno.env.get('PUBLISH_POSTS_CRON_SECRET')
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('[PublishPosts] Starting post publishing worker')

    // Fetch pending schedules that are due to publish
    const now = new Date().toISOString()
    
    // First, check for failed schedules that are ready for retry
    const { data: retrySchedules, error: retryError } = await supabase
      .from('schedules')
      .select('*')
      .eq('status', 'failed')
      .eq('target_type', 'post_candidate')
      .lte('next_retry_at', now)
      .lt('retry_count', 3)
      .order('next_retry_at', { ascending: true })
      .limit(10) // Limit retries to avoid overwhelming

    // Fetch new pending schedules
    const { data: pendingSchedules, error: schedulesError } = await supabase
      .from('schedules')
      .select('*')
      .eq('status', 'pending')
      .eq('target_type', 'post_candidate')
      .lte('publish_at', now)
      .order('publish_at', { ascending: true })
      .limit(40) // Process in batches to avoid overwhelming

    if (retryError || schedulesError) {
      console.error('[PublishPosts] Failed to fetch schedules:', { retryError, schedulesError })
      return new Response(
        JSON.stringify({ error: 'Failed to fetch schedules' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const schedules = [...(retrySchedules || []), ...(pendingSchedules || [])]

    if (schedulesError) {
      console.error('[PublishPosts] Failed to fetch schedules:', schedulesError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch schedules' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!schedules || schedules.length === 0) {
      console.log('[PublishPosts] No pending schedules to process')
      return new Response(
        JSON.stringify({ processed: 0, published: 0, failed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[PublishPosts] Processing ${schedules.length} schedules (${retrySchedules?.length || 0} retries, ${pendingSchedules?.length || 0} new)`)

    const results: PublishResult[] = []
    let publishedCount = 0
    let failedCount = 0

    // Process each schedule
    for (const schedule of schedules as Schedule[]) {
      try {
        const result = await processSchedule(supabase, schedule)
        results.push(result)
        
        if (result.success) {
          publishedCount++
          console.log(`[PublishPosts] ✓ Published schedule ${schedule.id}`)
        } else {
          failedCount++
          console.error(`[PublishPosts] ✗ Failed to publish schedule ${schedule.id}:`, result.error)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`[PublishPosts] ✗ Error processing schedule ${schedule.id}:`, errorMessage)
        
        // Update schedule with error and schedule retry if needed
        await handlePublishError(supabase, schedule, errorMessage)
        
        results.push({
          scheduleId: schedule.id,
          success: false,
          error: errorMessage
        })
        failedCount++
      }
    }

    const summary = {
      processed: schedules.length,
      published: publishedCount,
      failed: failedCount,
      results
    }

    console.log('[PublishPosts] Completed processing:', summary)

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[PublishPosts] Unhandled error:', errorMessage)
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function processSchedule(supabase: any, schedule: Schedule): Promise<PublishResult> {
  const { data: postCandidate, error: candidateError } = await supabase
    .from('post_candidates')
    .select('*')
    .eq('id', schedule.target_id)
    .single()

  if (candidateError || !postCandidate) {
    await updateScheduleStatus(supabase, schedule.id, 'failed', 'Post candidate not found')
    return {
      scheduleId: schedule.id,
      success: false,
      error: 'Post candidate not found'
    }
  }

  // Get location and Google connection info
  const { data: location, error: locationError } = await supabase
    .from('gbp_locations')
    .select('*')
    .eq('id', schedule.location_id)
    .single()

  if (locationError || !location) {
    await updateScheduleStatus(supabase, schedule.id, 'failed', 'Location not found')
    return {
      scheduleId: schedule.id,
      success: false,
      error: 'Location not found'
    }
  }

  // Get Google connection
  const { data: connections, error: connectionError } = await supabase
    .from('connections_google')
    .select('*')
    .eq('org_id', schedule.org_id)
    .limit(1)

  if (connectionError || !connections || connections.length === 0) {
    await updateScheduleStatus(supabase, schedule.id, 'failed', 'Google connection not found')
    return {
      scheduleId: schedule.id,
      success: false,
      error: 'Google connection not found'
    }
  }

  const connection = connections[0] as GoogleConnection

  try {
    // Publish to Google
    const googlePostName = await publishToGoogle(
      connection,
      location,
      postCandidate as PostCandidate
    )

    // Store in gbp_posts table
    await storeGooglePost(supabase, schedule, postCandidate as PostCandidate, googlePostName)

    // Update schedule status to published
    await updateScheduleStatus(supabase, schedule.id, 'published', null, googlePostName)

    // Create audit log
    await createAuditLog(supabase, schedule.org_id, 'post_published', schedule.id, {
      googlePostName,
      locationId: schedule.location_id
    })

    return {
      scheduleId: schedule.id,
      success: true,
      googlePostName
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Update schedule status to failed
    await updateScheduleStatus(supabase, schedule.id, 'failed', errorMessage)
    
    // Create audit log
    await createAuditLog(supabase, schedule.org_id, 'post_publish_failed', schedule.id, {
      error: errorMessage,
      locationId: schedule.location_id
    })

    return {
      scheduleId: schedule.id,
      success: false,
      error: errorMessage
    }
  }
}

async function getAccessToken(refreshToken: string): Promise<string> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured')
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text()
    throw new Error(`Failed to refresh access token: ${error}`)
  }

  const tokenData = await tokenResponse.json()
  return tokenData.access_token
}

async function publishToGoogle(
  connection: GoogleConnection,
  location: GbpLocation,
  postCandidate: PostCandidate
): Promise<string> {
  // Decrypt refresh token
  const refreshToken = await decryptRefreshToken(connection.refresh_token_enc)

  // Get fresh access token
  const accessToken = await getAccessToken(refreshToken)

  // Extract account and location IDs from google_location_name
  // Expected format: "accounts/{accountId}/locations/{locationId}"
  const accountId = connection.account_id
  const locationName = location.google_location_name

  // Extract just the location ID from the full resource name
  const locationIdMatch = locationName.match(/locations\/(\d+)/)
  const locationId = locationIdMatch ? locationIdMatch[1] : locationName.split('/').pop()

  if (!accountId || !locationId) {
    throw new Error(`Invalid account or location ID. Account: ${accountId}, Location: ${locationId}`)
  }

  console.log(`[PublishPosts] Publishing to account ${accountId}, location ${locationId}`)

  // Transform post candidate schema to Google API format
  const postData = transformPostSchema(postCandidate.schema, postCandidate.images)

  console.log(`[PublishPosts] Post data:`, JSON.stringify(postData, null, 2))

  try {
    // Create the post using Google My Business API v4
    const response = await fetch(
      `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/localPosts`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postData),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { message: errorText }
      }

      const errorMessage = errorData?.error?.message || errorData?.message || 'Unknown error'
      const errorStatus = response.status

      console.error(`[PublishPosts] Google API error (${errorStatus}): ${errorMessage}`)
      console.error(`[PublishPosts] Error details:`, errorText)

      // Check for common error scenarios
      if (errorStatus === 401 || errorStatus === 403) {
        throw new Error(`Authentication failed (${errorStatus}): ${errorMessage}. The OAuth token may have expired or lacks required permissions.`)
      } else if (errorStatus === 404) {
        throw new Error(`API endpoint not found (404): This may indicate the Posts API is not enabled for this Google Cloud project or the location doesn't exist. Error: ${errorMessage}`)
      } else if (errorStatus === 400) {
        throw new Error(`Invalid request (400): ${errorMessage}. Post data may be malformed.`)
      } else {
        throw new Error(`Google API error (${errorStatus}): ${errorMessage}`)
      }
    }

    const googlePost = await response.json()

    if (!googlePost || !googlePost.name) {
      throw new Error('Google API did not return a valid post. Response: ' + JSON.stringify(googlePost))
    }

    console.log(`[PublishPosts] Successfully created post: ${googlePost.name}`)
    return googlePost.name

  } catch (error: any) {
    // Re-throw if it's already one of our formatted errors
    if (error.message.includes('Authentication failed') ||
        error.message.includes('API endpoint not found') ||
        error.message.includes('Invalid request')) {
      throw error
    }

    // Otherwise, wrap it in a generic error
    console.error(`[PublishPosts] Unexpected error:`, error)
    throw new Error(`Failed to publish post: ${error.message}`)
  }
}

function transformPostSchema(schema: Record<string, any>, images: string[]): any {
  // Base post data - all posts need languageCode, summary, and topicType
  const postData: any = {
    languageCode: 'en',
    summary: schema.description || schema.body || '',
    topicType: mapPostType(schema.type)
  }

  // Handle EVENT posts
  if (schema.type === 'EVENT') {
    postData.event = {
      title: schema.title || schema.headline || 'Special Event',
      schedule: {}
    }

    // Parse event dates
    if (schema.eventStartDate || schema.startDate) {
      postData.event.schedule.startDate = parseDate(schema.eventStartDate || schema.startDate)
    } else {
      // Default to tomorrow if no date specified
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      postData.event.schedule.startDate = parseDate(tomorrow.toISOString())
    }

    if (schema.eventEndDate || schema.endDate) {
      postData.event.schedule.endDate = parseDate(schema.eventEndDate || schema.endDate)
    }
  }

  // Handle OFFER posts
  else if (schema.type === 'OFFER') {
    postData.offer = {
      couponCode: schema.couponCode || '',
      redeemOnlineUrl: schema.offerUrl || schema.termsUrl || '',
      termsConditions: schema.terms || schema.offerTerms || 'Terms and conditions apply'
    }
  }

  // Add call to action if provided
  if (schema.cta && schema.cta.action && schema.cta.url) {
    postData.callToAction = {
      actionType: schema.cta.action,
      url: schema.cta.url
    }
  }

  // Add media if images are provided
  // Note: Google requires media to be uploaded first via Media API, then referenced by MediaItem
  // For now, we'll skip media upload - this needs to be implemented separately
  if (images && images.length > 0) {
    console.log(`[PublishPosts] Media upload not yet implemented. ${images.length} images will be skipped.`)
    // TODO: Implement media upload via Media API
    // postData.media = images.map(imageUrl => ({
    //   mediaFormat: 'PHOTO',
    //   sourceUrl: imageUrl
    // }))
  }

  return postData
}

function mapPostType(type: string): string {
  switch (type) {
    case 'WHATS_NEW':
      return 'STANDARD'
    case 'EVENT':
      return 'EVENT'
    case 'OFFER':
      return 'OFFER'
    default:
      return 'STANDARD'
  }
}

function parseDate(dateString: string): { year: number; month: number; day: number } {
  const date = new Date(dateString)
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1, // Google API uses 1-based months
    day: date.getDate()
  }
}

async function storeGooglePost(
  supabase: any,
  schedule: Schedule,
  postCandidate: PostCandidate,
  googlePostName: string
): Promise<void> {
  const schema = postCandidate.schema
  
  const postData = {
    org_id: schedule.org_id,
    location_id: schedule.location_id,
    google_post_name: googlePostName,
    summary: schema.description || null,
    topic_type: mapPostType(schema.type),
    call_to_action_type: schema.cta?.action || null,
    call_to_action_url: schema.cta?.url || null,
    event_title: schema.title || null,
    event_start_date: schema.createdAt ? new Date(schema.createdAt).toISOString().split('T')[0] : null,
    event_end_date: schema.endDate ? new Date(schema.endDate).toISOString().split('T')[0] : null,
    offer_coupon_code: schema.couponCode || null,
    offer_redeem_url: schema.termsUrl || null,
    offer_terms: schema.terms || null,
    media_urls: postCandidate.images || [],
    state: 'LIVE',
    meta: schema
  }

  const { error } = await supabase.from('gbp_posts').insert(postData)
  
  if (error) {
    console.error('[PublishPosts] Failed to store Google post:', error)
    // Don't throw here - the post was published successfully, we just failed to store it
  }
}

async function updateScheduleStatus(
  supabase: any,
  scheduleId: string,
  status: string,
  error: string | null = null,
  providerRef: string | null = null
): Promise<void> {
  const updateData: any = { status }
  
  if (error) {
    updateData.meta = { error, lastAttempt: new Date().toISOString() }
  }
  
  if (providerRef) {
    updateData.provider_ref = providerRef
  }

  const { error: updateError } = await supabase
    .from('schedules')
    .update(updateData)
    .eq('id', scheduleId)

  if (updateError) {
    console.error(`[PublishPosts] Failed to update schedule ${scheduleId}:`, updateError)
  }
}

async function createAuditLog(
  supabase: any,
  orgId: string,
  action: string,
  target: string,
  meta: Record<string, any>
): Promise<void> {
  const { error } = await supabase.from('audit_logs').insert({
    org_id: orgId,
    action,
    target,
    meta
  })

  if (error) {
    console.error('[PublishPosts] Failed to create audit log:', error)
  }
}

async function handlePublishError(
  supabase: any,
  schedule: Schedule,
  errorMessage: string
): Promise<void> {
  const currentRetryCount = (schedule as any).retry_count || 0
  const maxRetries = 3
  
  if (currentRetryCount >= maxRetries) {
    // Max retries reached, mark as permanently failed
    await updateScheduleStatus(supabase, schedule.id, 'failed', errorMessage)
    
    await createAuditLog(supabase, schedule.org_id, 'post_publish_failed_permanent', schedule.id, {
      error: errorMessage,
      retryCount: currentRetryCount,
      locationId: schedule.location_id
    })
    
    console.error(`[PublishPosts] Schedule ${schedule.id} permanently failed after ${maxRetries} retries`)
  } else {
    // Schedule retry with exponential backoff
    const retryDelay = Math.min(1000 * Math.pow(2, currentRetryCount), 60000) // Max 1 minute
    const nextRetryAt = new Date(Date.now() + retryDelay).toISOString()
    
    const { error } = await supabase
      .from('schedules')
      .update({
        status: 'failed',
        retry_count: currentRetryCount + 1,
        last_error: errorMessage,
        next_retry_at: nextRetryAt
      })
      .eq('id', schedule.id)
    
    if (error) {
      console.error(`[PublishPosts] Failed to update schedule for retry:`, error)
    }
    
    await createAuditLog(supabase, schedule.org_id, 'post_publish_retry_scheduled', schedule.id, {
      error: errorMessage,
      retryCount: currentRetryCount + 1,
      nextRetryAt,
      locationId: schedule.location_id
    })
    
    console.log(`[PublishPosts] Schedule ${schedule.id} scheduled for retry #${currentRetryCount + 1} at ${nextRetryAt}`)
  }
}
