/**
 * Complete end-to-end GBP post publishing pipeline
 * 1. Generate post content with AI
 * 2. Generate image with Runware
 * 3. Create post_candidate
 * 4. Schedule for publishing
 * 5. Monitor until published
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Database } from './src/types/database';

// Load environment variables from .env.local
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && !key.startsWith('#') && valueParts.length > 0) {
      const value = valueParts.join('=').trim();
      process.env[key.trim()] = value;
    }
  });
  console.log('✅ Loaded environment variables from .env.local');
}

// Environment configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const RUNWARE_API_KEY = process.env.RUNWARE_API_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !OPENAI_API_KEY || !RUNWARE_API_KEY) {
  console.error('❌ Missing required environment variables');
  console.error(`SUPABASE_URL: ${SUPABASE_URL ? '✓' : '✗'}`);
  console.error(`SUPABASE_SERVICE_KEY: ${SUPABASE_SERVICE_KEY ? '✓' : '✗'}`);
  console.error(`OPENAI_API_KEY: ${OPENAI_API_KEY ? '✓' : '✗'}`);
  console.error(`RUNWARE_API_KEY: ${RUNWARE_API_KEY ? '✓' : '✗'}`);
  process.exit(1);
}

// Initialize clients
const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Texas Lone Star details
const LOCATION_ID = '34dee80b-b958-44c3-bd80-b998ae587fa2';
const ORG_ID = 'efd2615e-998b-4b70-83e0-0800c7cffc5a';
const GOOGLE_LOCATION_NAME = 'locations/16919135625305195332';

interface GBPPostSchema {
  type: 'WHATS_NEW' | 'EVENT' | 'OFFER';
  headline: string;
  body: string;
  cta: 'LEARN_MORE' | 'CALL' | 'SIGN_UP' | 'BOOK' | 'ORDER' | 'SHOP';
  link: string;
  hashtags: string[];
  imageBrief: string;
  riskScore: number;
}

async function generatePostContent(): Promise<GBPPostSchema> {
  console.log('🤖 Generating post content with GPT-4o-mini...');

  const prompt = `You are an expert content creator for Google Business Profile posts. Generate a high-quality, engaging post for Texas Lone Star AC & Heating LLC.

Business Context:
- HVAC company serving Texas (AC and heating services)
- Professional, reliable, customer-focused brand
- Services: AC repair, heating repair, installation, maintenance
- Target audience: Texas homeowners and businesses

Generate a post that:
- Promotes their services in a compelling way
- Emphasizes reliability and quick response times
- Is appropriate for Texas climate (hot summers)
- Includes a strong call-to-action
- Follows Google Business Profile best practices
- Has LOW risk score (under 0.3)

Return ONLY valid JSON matching this schema:
{
  "type": "WHATS_NEW",
  "headline": "string (max 58 chars, compelling hook)",
  "body": "string (max 1500 chars, engaging content about AC/heating services, benefits, why choose them)",
  "cta": "CALL" or "LEARN_MORE" or "BOOK",
  "link": "https://texaslonestarac.com",
  "hashtags": ["array of 4-6 relevant hashtags like #HVAC, #ACRepair, #TexasHVAC"],
  "imageBrief": "string (max 400 chars, detailed description for image generation - professional HVAC service scene)",
  "riskScore": 0.15
}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are an expert at creating Google Business Profile posts that drive customer engagement and conversions. Always return valid JSON.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' }
  });

  const content = completion.choices[0].message.content;
  if (!content) {
    throw new Error('No content generated from OpenAI');
  }

  const postSchema = JSON.parse(content) as GBPPostSchema;

  console.log('✅ Post content generated:');
  console.log(`   Type: ${postSchema.type}`);
  console.log(`   Headline: ${postSchema.headline}`);
  console.log(`   Body: ${postSchema.body.substring(0, 100)}...`);
  console.log(`   Risk Score: ${postSchema.riskScore}`);

  return postSchema;
}

async function generateImage(imageBrief: string): Promise<string> {
  console.log('🎨 Generating image with Runware.ai...');
  console.log(`   Prompt: ${imageBrief}`);

  try {
    // Runware API endpoint - must be an array of request objects with valid UUIDv4
    const response = await axios.post(
      'https://api.runware.ai/v1',
      [
        {
          taskType: 'imageInference',
          taskUUID: uuidv4(), // Generate valid UUIDv4
          positivePrompt: `${imageBrief}, professional HVAC service, high quality, clean, modern, photorealistic`,
          negativePrompt: 'low quality, blurry, unprofessional, text, watermark, cartoon, illustration',
          width: 1152,
          height: 896,
          numberResults: 1,
          model: 'runware:100@1'
        }
      ],
      {
        headers: {
          'Authorization': `Bearer ${RUNWARE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Runware response:', JSON.stringify(response.data, null, 2));

    // Response is an array of results
    if (response.data && response.data.data && Array.isArray(response.data.data) && response.data.data[0]) {
      const result = response.data.data[0];
      const imageUrl = result.imageURL;
      console.log(`✅ Image generated: ${imageUrl}`);

      // Download and save the image locally
      const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const tempDir = '/tmp/gbp-images';
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const imagePath = path.join(tempDir, `texas-lone-star-${Date.now()}.jpg`);
      fs.writeFileSync(imagePath, imageResponse.data);
      console.log(`   Saved to: ${imagePath}`);

      return imageUrl; // Return the URL for the database
    } else {
      throw new Error('No image URL in Runware response');
    }
  } catch (error: any) {
    console.error('❌ Runware API error:', error.response?.data || error.message);
    throw error;
  }
}

async function createPostCandidate(postSchema: GBPPostSchema, imageUrl: string): Promise<string> {
  console.log('💾 Creating post_candidate in database...');

  const { data, error } = await supabase
    .from('post_candidates')
    .insert({
      org_id: ORG_ID,
      location_id: LOCATION_ID,
      schema: postSchema as any,
      images: [imageUrl],
      status: 'approved'
    })
    .select('id')
    .single();

  if (error) {
    console.error('❌ Database error:', error);
    throw error;
  }

  console.log(`✅ Post candidate created: ${data.id}`);
  return data.id;
}

async function createSchedule(postCandidateId: string): Promise<string> {
  console.log('📅 Creating schedule for 30 seconds from now...');

  const publishAt = new Date(Date.now() + 30000); // 30 seconds from now

  const { data, error } = await supabase
    .from('schedules')
    .insert({
      org_id: ORG_ID,
      location_id: LOCATION_ID,
      target_type: 'post_candidate',
      target_id: postCandidateId,
      publish_at: publishAt.toISOString(),
      status: 'pending'
    })
    .select('id')
    .single();

  if (error) {
    console.error('❌ Schedule creation error:', error);
    throw error;
  }

  console.log(`✅ Schedule created: ${data.id}`);
  console.log(`   Publish at: ${publishAt.toISOString()}`);
  return data.id;
}

async function monitorSchedule(scheduleId: string): Promise<void> {
  console.log('⏳ Monitoring schedule status...');

  const maxAttempts = 8; // 40 seconds total (8 attempts * 5 seconds)
  let attempts = 0;

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    attempts++;

    const { data, error } = await supabase
      .from('schedules')
      .select('status, provider_ref, last_error')
      .eq('id', scheduleId)
      .single();

    if (error) {
      console.error('❌ Error checking schedule:', error);
      continue;
    }

    console.log(`   [${attempts}/${maxAttempts}] Status: ${data.status}`);

    if (data.status === 'published') {
      console.log('🎉 POST PUBLISHED SUCCESSFULLY!');
      console.log(`   Google Post ID: ${data.provider_ref}`);

      // Verify in GBP
      if (data.provider_ref) {
        console.log(`   View on Google: https://business.google.com/posts/l/${GOOGLE_LOCATION_NAME.split('/')[1]}`);
      }
      return;
    } else if (data.status === 'failed') {
      console.error('❌ Publishing failed!');
      console.error(`   Error: ${data.last_error}`);
      throw new Error(`Publishing failed: ${data.last_error}`);
    }
  }

  console.error('⏰ Timeout waiting for publish (40 seconds elapsed)');

  // Check final status
  const { data: finalData } = await supabase
    .from('schedules')
    .select('status, last_error')
    .eq('id', scheduleId)
    .single();

  throw new Error(`Timeout - Final status: ${finalData?.status}, Error: ${finalData?.last_error}`);
}

async function main() {
  console.log('🚀 Starting complete GBP post publishing pipeline\n');
  console.log(`Organization: ${ORG_ID}`);
  console.log(`Location: ${LOCATION_ID}`);
  console.log(`Google Location: ${GOOGLE_LOCATION_NAME}\n`);

  try {
    // Step 1: Generate post content with AI
    const postSchema = await generatePostContent();
    console.log();

    // Step 2: Generate image
    const imageUrl = await generateImage(postSchema.imageBrief);
    console.log();

    // Step 3: Create post candidate
    const postCandidateId = await createPostCandidate(postSchema, imageUrl);
    console.log();

    // Step 4: Schedule for publishing
    const scheduleId = await createSchedule(postCandidateId);
    console.log();

    // Step 5: Monitor until published
    await monitorSchedule(scheduleId);
    console.log();

    console.log('✨ COMPLETE! Post has been published to Google Business Profile.');
    console.log(`\nPost Candidate ID: ${postCandidateId}`);
    console.log(`Schedule ID: ${scheduleId}`);

  } catch (error: any) {
    console.error('\n❌ PIPELINE FAILED:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
