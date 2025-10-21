#!/bin/bash

# Script to check pending posts in the schedules table
# Helps diagnose stuck posts and see what needs to be published

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Checking Pending Posts ===${NC}\n"

# Query pending posts
echo -e "${YELLOW}Pending schedules (ready to publish):${NC}"
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "
SELECT
  s.id,
  s.status,
  s.publish_at,
  s.retry_count,
  l.google_location_name as location_name,
  pc.schema->>'headline' as post_headline,
  CASE
    WHEN s.publish_at <= NOW() THEN 'OVERDUE'
    ELSE 'SCHEDULED'
  END as publish_status
FROM schedules s
JOIN gbp_locations l ON s.location_id = l.id
LEFT JOIN post_candidates pc ON s.target_id = pc.id
WHERE s.status = 'pending'
ORDER BY s.publish_at ASC;
"

echo ""
echo -e "${YELLOW}Failed schedules (needs retry):${NC}"
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "
SELECT
  s.id,
  s.status,
  s.publish_at,
  s.retry_count,
  s.last_error,
  l.google_location_name as location_name
FROM schedules s
JOIN gbp_locations l ON s.location_id = l.id
WHERE s.status = 'failed'
ORDER BY s.publish_at ASC
LIMIT 10;
"

echo ""
echo -e "${YELLOW}Summary:${NC}"
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "
SELECT
  status,
  COUNT(*) as count,
  COUNT(CASE WHEN publish_at <= NOW() THEN 1 END) as overdue
FROM schedules
GROUP BY status
ORDER BY status;
"

echo ""
echo -e "${GREEN}✓ Check complete${NC}"
echo ""
echo -e "${BLUE}Note: Google Posts API is deprecated. Posts must be published manually.${NC}"
echo -e "${BLUE}Run ./scripts/mark-post-as-manual.sh <schedule_id> to mark a post for manual publishing.${NC}"
