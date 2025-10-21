#!/bin/bash
# Add jasonfreynolds@gmail.com as owner to Supabase database
# Usage: ./scripts/add-owner-user.sh

set -e

EMAIL="jasonfreynolds@gmail.com"
PASSWORD="thematrix"
NAME="Jason Reynolds"
ORG_NAME="Acme Coffee Shops"

echo "================================================"
echo "Adding owner user to LocalSpotlight database"
echo "================================================"
echo ""
echo "Email: $EMAIL"
echo "Password: $PASSWORD"
echo "Organization: $ORG_NAME"
echo ""

# Check if Supabase is running
if ! curl -s http://127.0.0.1:54321/rest/v1/ > /dev/null 2>&1; then
  echo "❌ Error: Supabase is not running on port 54321"
  echo "   Please start it with: pnpm db:start"
  exit 1
fi

echo "✅ Supabase is running"
echo ""

# Step 1: Create user in Supabase Auth
echo "Step 1: Creating user in Supabase Auth..."
echo "----------------------------------------------"

# Try to create the user via Supabase Auth API
USER_RESULT=$(curl -s -X POST "http://127.0.0.1:54321/auth/v1/signup" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"options\":{\"data\":{\"name\":\"$NAME\"}}}")

# Check if user already exists or was created
if echo "$USER_RESULT" | grep -q "User already registered"; then
  echo "⚠️  User already exists in auth.users"
elif echo "$USER_RESULT" | grep -q '"id"'; then
  echo "✅ User created successfully"
else
  echo "⚠️  Unexpected result from auth API, checking database..."
fi

# Get user ID from database
sleep 1
USER_ID=$(psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -t -c \
  "SELECT id FROM auth.users WHERE email = '$EMAIL';" | xargs)

if [ -z "$USER_ID" ]; then
  echo "❌ Error: Could not find or create user in auth.users"
  echo "   Response from API: $USER_RESULT"
  exit 1
fi

echo "   User ID: $USER_ID"

echo ""

# Step 2: Create or update user profile
echo "Step 2: Creating user profile..."
echo "----------------------------------------------"

psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" << EOF
INSERT INTO users (id, email, name)
VALUES ('$USER_ID', '$EMAIL', '$NAME')
ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      name = EXCLUDED.name;
EOF

echo "✅ User profile created/updated"
echo ""

# Step 3: Create organization if it doesn't exist
echo "Step 3: Ensuring organization exists..."
echo "----------------------------------------------"

ORG_ID="00000001-0001-0001-0001-000000000001"

psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" << EOF > /dev/null 2>&1
INSERT INTO orgs (id, name, plan) 
VALUES ('$ORG_ID', '$ORG_NAME', 'pro')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
EOF

echo "✅ Organization ready"
echo "   Org ID: $ORG_ID"
echo ""

# Step 4: Add user as owner to organization
echo "Step 4: Adding user as owner to organization..."
echo "----------------------------------------------"

psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" << EOF
INSERT INTO org_members (org_id, user_id, role)
VALUES ('$ORG_ID', '$USER_ID', 'owner')
ON CONFLICT (org_id, user_id) DO UPDATE
  SET role = 'owner';
EOF

echo "✅ User added as owner to organization"
echo ""

# Step 5: Verify the setup
echo "Step 5: Verifying setup..."
echo "----------------------------------------------"

VERIFICATION=$(psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -t -c \
  "SELECT 
     u.email,
     u.name,
     o.name as org_name,
     om.role
   FROM users u
   JOIN org_members om ON u.id = om.user_id
   JOIN orgs o ON om.org_id = o.id
   WHERE u.email = '$EMAIL';")

if [ -z "$VERIFICATION" ]; then
  echo "❌ Error: Could not verify user setup"
  exit 1
fi

echo "✅ Verification successful:"
echo "$VERIFICATION"
echo ""

echo "================================================"
echo "✅ SUCCESS!"
echo "================================================"
echo ""
echo "You can now sign in at: http://localhost:3000/sign-in"
echo ""
echo "Credentials:"
echo "  Email: $EMAIL"
echo "  Password: $PASSWORD"
echo ""
echo "Organization: $ORG_NAME"
echo "Role: owner"
echo ""

