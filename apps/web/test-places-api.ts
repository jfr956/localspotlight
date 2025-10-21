/**
 * Test Google Places API (New) for Reviews Access
 *
 * The Places API can fetch reviews for ANY business (not just owned ones)
 * but has limitations:
 * - Only returns top 5 reviews
 * - Cannot post replies
 * - Requires different API key (not OAuth)
 */

import { config } from 'dotenv';
config();

async function testPlacesAPI() {
  console.log('Testing Google Places API (New) for Reviews...\n');

  // Note: This requires GOOGLE_PLACES_API_KEY in .env
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    console.log('❌ GOOGLE_PLACES_API_KEY not found in environment');
    console.log('To enable this, you need to:');
    console.log('1. Go to https://console.cloud.google.com/apis/library');
    console.log('2. Enable "Places API (New)"');
    console.log('3. Create an API Key (not OAuth)');
    console.log('4. Add GOOGLE_PLACES_API_KEY=your_key to .env.local');
    return;
  }

  // Example: Search for a place first to get Place ID
  const searchText = 'Texas Lone Star AC & Heating LLC';

  try {
    // Step 1: Text Search to find Place ID
    console.log(`🔍 Searching for: ${searchText}`);
    const searchResponse = await fetch(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName'
        },
        body: JSON.stringify({
          textQuery: searchText
        })
      }
    );

    const searchData = await searchResponse.json();
    console.log('Search Results:', JSON.stringify(searchData, null, 2));

    if (!searchData.places || searchData.places.length === 0) {
      console.log('❌ No places found');
      return;
    }

    const placeId = searchData.places[0].id;
    console.log(`✅ Found Place ID: ${placeId}\n`);

    // Step 2: Get Place Details with Reviews
    console.log('📊 Fetching reviews...');
    const detailsResponse = await fetch(
      `https://places.googleapis.com/v1/${placeId}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'reviews,rating,userRatingCount'
        }
      }
    );

    const details = await detailsResponse.json();

    if (details.error) {
      console.log('❌ Error fetching details:', details.error.message);
      return;
    }

    console.log('\n=== REVIEW DATA ===');
    console.log(`Overall Rating: ${details.rating || 'N/A'}`);
    console.log(`Total Reviews: ${details.userRatingCount || 'N/A'}`);
    console.log(`Reviews Returned: ${details.reviews?.length || 0}\n`);

    if (details.reviews && details.reviews.length > 0) {
      console.log('✅ Reviews Available!\n');
      details.reviews.forEach((review: any, index: number) => {
        console.log(`--- Review ${index + 1} ---`);
        console.log(`Author: ${review.authorAttribution?.displayName || 'Anonymous'}`);
        console.log(`Rating: ${review.rating}/5`);
        console.log(`Text: ${review.text?.text || 'No text'}`);
        console.log(`Published: ${review.publishTime || 'Unknown'}`);
        console.log(`Relative Time: ${review.relativePublishTimeDescription || 'Unknown'}`);
        console.log('');
      });

      console.log('⚠️ LIMITATIONS:');
      console.log('- Only top 5 reviews are returned (Google limitation)');
      console.log('- Cannot post replies through this API');
      console.log('- Reviews may not include all reviews from Business Profile');
      console.log('- This API does NOT require business ownership');

    } else {
      console.log('❌ No reviews returned');
    }

  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

testPlacesAPI();
