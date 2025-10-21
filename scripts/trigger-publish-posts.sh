#!/bin/bash

# Script to manually trigger post publishing
# This calls the Supabase Edge Function to publish pending posts

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Triggering post publishing...${NC}"

# Get Supabase URL and keys
SUPABASE_URL=$(grep NEXT_PUBLIC_SUPABASE_URL "$PROJECT_ROOT/apps/web/.env.local" | cut -d '=' -f2 | tr -d '"' | tr -d ' ')
SUPABASE_SERVICE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY "$PROJECT_ROOT/apps/web/.env.local" | cut -d '=' -f2 | tr -d '"' | tr -d ' ')

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo -e "${RED}Error: Could not find Supabase credentials in .env.local${NC}"
    exit 1
fi

# Call the Edge Function
RESPONSE=$(curl -s -X POST \
    "${SUPABASE_URL}/functions/v1/publish-posts" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
    -H "Content-Type: application/json")

# Parse and display the response
echo -e "${GREEN}Response:${NC}"
echo "$RESPONSE" | jq '.' || echo "$RESPONSE"

# Check if successful
if echo "$RESPONSE" | jq -e '.processed' > /dev/null 2>&1; then
    PROCESSED=$(echo "$RESPONSE" | jq -r '.processed')
    PUBLISHED=$(echo "$RESPONSE" | jq -r '.published')
    FAILED=$(echo "$RESPONSE" | jq -r '.failed')

    echo ""
    echo -e "${GREEN}✓ Post publishing completed${NC}"
    echo -e "  Processed: $PROCESSED"
    echo -e "  Published: $PUBLISHED"
    echo -e "  Failed: $FAILED"
else
    echo -e "${RED}✗ Post publishing failed${NC}"
    exit 1
fi
