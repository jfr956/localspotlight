import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '.env.local') });

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const WORKING_ORG_ID = 'efd2615e-998b-4b70-83e0-0800c7cffc5a';
const WORKING_LOCATION_ID = '34dee80b-b958-44c3-bd80-b998ae587fa2'; // Texas Lone Star AC & Heating

interface RunwareImageResponse {
  taskUUID: string;
  imageURL?: string;
  imageUUID?: string;
  error?: string;
}

async function generateImageWithRunware(prompt: string): Promise<string | null> {
  console.log('  Generating image with Runware...');
  console.log(`  Prompt: ${prompt}`);

  try {
    const response = await fetch('https://api.runware.ai/v1', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RUNWARE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{
        taskType: 'imageInference',
        taskUUID: crypto.randomUUID(),
        positivePrompt: prompt,
        width: 1024,
        height: 1024,
        model: 'runware:100@1',
        numberResults: 1,
        outputType: 'URL'
      }])
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`  ❌ Runware API error: ${response.status} - ${errorText}`);
      return null;
    }

    const results = await response.json();
    console.log('  Raw response:', JSON.stringify(results, null, 2));

    if (Array.isArray(results) && results.length > 0) {
      const result = results[0];
      if (result.imageURL) {
        console.log(`  ✓ Image generated: ${result.imageURL}`);
        return result.imageURL;
      }
      if (result.error) {
        console.error(`  ❌ Runware error: ${result.error}`);
      }
    }

    console.error('  ❌ No image URL in response');
    return null;
  } catch (error: any) {
    console.error(`  ❌ Failed to generate image: ${error.message}`);
    return null;
  }
}

async function generatePostContent(): Promise<{ post: any; imageBrief: string } | null> {
  console.log('  Generating post content with OpenAI...');

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  const prompt = `Generate a Google Business Profile post for Texas Lone Star AC & Heating LLC, a heating and air conditioning service provider in Texas.

Create a WHATS_NEW post about spring AC maintenance with a professional, helpful tone.

Return ONLY valid JSON in this exact format:
{
  "type": "WHATS_NEW",
  "title": "string (max 58 chars)",
  "description": "string (max 1500 chars)",
  "cta": {
    "action": "LEARN_MORE",
    "url": "https://www.txlonestaracandheating.com"
  },
  "imageBrief": "Professional photo of an HVAC technician servicing an air conditioning unit, clean modern home interior, bright natural lighting, high quality"
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a content generator for local businesses. Always respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      console.error('  ❌ No content generated');
      return null;
    }

    const parsed = JSON.parse(content);
    console.log(`  ✓ Generated post: ${parsed.title}`);
    return { post: parsed, imageBrief: parsed.imageBrief };
  } catch (error: any) {
    console.error(`  ❌ Failed to generate content: ${error.message}`);
    return null;
  }
}

async function testImageUpload() {
  console.log('=== IMAGE UPLOAD TEST ===\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Step 1: Generate post content
  console.log('Step 1: Generating post content...');
  const generated = await generatePostContent();
  if (!generated) {
    console.error('❌ Failed to generate post content');
    return;
  }
  console.log('');

  // Step 2: Generate image
  console.log('Step 2: Generating image...');
  const imageUrl = await generateImageWithRunware(generated.imageBrief);

  // If Runware fails, use a placeholder image URL
  const finalImageUrl = imageUrl || 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=1024&h=1024&fit=crop';
  if (!imageUrl) {
    console.log('  ⚠ Using placeholder image from Unsplash');
  }
  console.log('');

  // Step 3: Create post candidate with image
  console.log('Step 3: Creating post candidate with image...');
  const candidateData = {
    org_id: WORKING_ORG_ID,
    location_id: WORKING_LOCATION_ID,
    schema: generated.post,
    images: [finalImageUrl],
    status: 'approved'
  };

  const { data: candidate, error: candidateError } = await supabase
    .from('post_candidates')
    .insert(candidateData)
    .select()
    .single();

  if (candidateError || !candidate) {
    console.error('❌ Failed to create candidate:', candidateError);
    return;
  }
  console.log(`  ✓ Created candidate: ${candidate.id}`);
  console.log(`  Post type: ${candidate.schema.type}`);
  console.log(`  Title: ${candidate.schema.title}`);
  console.log(`  Images: ${candidate.images.length}`);
  console.log('');

  // Step 4: Create schedule (20 seconds from now)
  console.log('Step 4: Creating schedule...');
  const publishAt = new Date(Date.now() + 20000); // 20 seconds from now

  const scheduleData = {
    org_id: WORKING_ORG_ID,
    location_id: WORKING_LOCATION_ID,
    target_type: 'post_candidate',
    target_id: candidate.id,
    publish_at: publishAt.toISOString(),
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
  console.log(`  Status: ${schedule.status}`);
  console.log('');

  // Step 5: Wait for scheduler to process
  console.log('Step 5: Waiting for scheduler to process (up to 40 seconds)...');
  console.log('  Check the edge function logs (shell 808e4a) for:');
  console.log('    - "Uploading X images to Google Media API..."');
  console.log('    - "Successfully uploaded X images"');
  console.log('    - "Added X media items to post"');
  console.log('');

  let attempts = 0;
  const maxAttempts = 8; // 8 checks * 5 seconds = 40 seconds

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    attempts++;

    const { data: updatedSchedule } = await supabase
      .from('schedules')
      .select('*')
      .eq('id', schedule.id)
      .single();

    if (!updatedSchedule) continue;

    console.log(`  Attempt ${attempts}/${maxAttempts}: Status = ${updatedSchedule.status}`);

    if (updatedSchedule.status === 'published') {
      console.log('\n✓ POST PUBLISHED SUCCESSFULLY!');
      console.log(`  Schedule ID: ${updatedSchedule.id}`);
      console.log(`  Status: ${updatedSchedule.status}`);
      console.log(`  Google Post ID: ${updatedSchedule.provider_ref || 'Not found'}`);
      if (updatedSchedule.meta) {
        console.log(`  Meta:`, JSON.stringify(updatedSchedule.meta, null, 2));
      }
      console.log('\n=== TEST COMPLETE - SUCCESS ===');
      return;
    }

    if (updatedSchedule.status === 'failed') {
      console.error('\n❌ POST PUBLISHING FAILED');
      console.log(`  Schedule ID: ${updatedSchedule.id}`);
      console.log(`  Status: ${updatedSchedule.status}`);
      console.log(`  Error: ${updatedSchedule.last_error || 'Unknown error'}`);
      console.log(`  Retry count: ${updatedSchedule.retry_count || 0}`);
      if (updatedSchedule.meta) {
        console.log(`  Meta:`, JSON.stringify(updatedSchedule.meta, null, 2));
      }
      console.log('\n=== TEST COMPLETE - FAILED ===');
      return;
    }
  }

  console.error('\n❌ TIMEOUT: Schedule did not complete within 40 seconds');
  console.log(`  Final status: ${schedule.status}`);
  console.log('\n=== TEST COMPLETE - TIMEOUT ===');
}

testImageUpload();
