#!/bin/bash

# Script to apply seed data to local Supabase database
# Usage: ./scripts/seed-db.sh

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
SEED_FILE="$PROJECT_ROOT/supabase/seed.sql"

# Check if Supabase is running
if ! supabase status > /dev/null 2>&1; then
    echo "Error: Supabase is not running. Start it with: supabase start"
    exit 1
fi

# Database connection details
DB_HOST="127.0.0.1"
DB_PORT="54322"
DB_USER="postgres"
DB_NAME="postgres"
DB_PASSWORD="postgres"

echo "Applying seed data to local database..."
echo "Database: postgresql://$DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
echo "Seed file: $SEED_FILE"
echo ""

# Apply seed data
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SEED_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "Seed data applied successfully!"
    echo ""
    echo "Verification:"
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << EOF
SELECT 'Organizations:' as table_name, count(*)::text as count FROM orgs
UNION ALL
SELECT 'GBP Accounts:', count(*)::text FROM gbp_accounts
UNION ALL
SELECT 'GBP Locations:', count(*)::text FROM gbp_locations
UNION ALL
SELECT 'GBP Reviews:', count(*)::text FROM gbp_reviews
UNION ALL
SELECT 'GBP Q&A:', count(*)::text FROM gbp_qna
UNION ALL
SELECT 'AI Generations:', count(*)::text FROM ai_generations
UNION ALL
SELECT 'Post Candidates:', count(*)::text FROM post_candidates
UNION ALL
SELECT 'Automation Policies:', count(*)::text FROM automation_policies
UNION ALL
SELECT 'Safety Rules:', count(*)::text FROM safety_rules
UNION ALL
SELECT 'Audit Logs:', count(*)::text FROM audit_logs;
EOF
    echo ""
    echo "Next steps:"
    echo "1. Create test user: supabase auth signup --email jasonfreynolds@gmail.com --password thematrix"
    echo "2. Get user ID: psql ... -c \"SELECT id FROM auth.users WHERE email = 'jasonfreynolds@gmail.com';\""
    echo "3. Link to org: psql ... -c \"INSERT INTO users (id, email, name) VALUES ('[user_id]', 'jasonfreynolds@gmail.com', 'Jason Reynolds');\""
    echo "4. Add org membership: psql ... -c \"INSERT INTO org_members (org_id, user_id, role) VALUES ('11111111-1111-1111-1111-111111111111', '[user_id]', 'owner');\""
else
    echo "Error: Failed to apply seed data"
    exit 1
fi
