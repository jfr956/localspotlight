-- Reset Google OAuth Connections
-- This script removes all Google OAuth connections and related data
-- Run this when switching to a new Google Cloud project or fixing OAuth issues

-- WARNING: This will delete all Google connections and synced data!
-- Make sure you want to do this before running.

BEGIN;

-- Delete all Google connections (cascades to related data due to FK constraints)
DELETE FROM connections_google;

-- Delete all GBP accounts
DELETE FROM gbp_accounts;

-- Optionally, if you want to also clear synced location data:
-- DELETE FROM gbp_reviews;
-- DELETE FROM gbp_qna;
-- DELETE FROM gbp_locations;

COMMIT;

-- After running this script:
-- 1. Go to https://myaccount.google.com/permissions and revoke access to LocalSpotlight
-- 2. Go to /integrations/google in the app
-- 3. Click "Continue with Google" to reconnect with the new OAuth credentials
-- 4. Sync locations and mark them as managed
-- 5. Sync reviews and Q&A
