-- Add indexes for efficient querying of pending schedules
-- This improves performance for the post publisher worker
-- Note: CONCURRENTLY cannot be used in migrations, only in live databases

-- Index for finding pending schedules that are due to publish
CREATE INDEX IF NOT EXISTS idx_schedules_pending_publish_at
ON schedules(publish_at)
WHERE status = 'pending' AND target_type = 'post_candidate';

-- Composite index for organization-specific queries
CREATE INDEX IF NOT EXISTS idx_schedules_org_pending
ON schedules(org_id, publish_at)
WHERE status = 'pending';

-- Index for location-specific queries
CREATE INDEX IF NOT EXISTS idx_schedules_location_pending
ON schedules(location_id, publish_at)
WHERE status = 'pending' AND target_type = 'post_candidate';

-- Add a retry count column to schedules for better error handling
ALTER TABLE schedules
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_error TEXT,
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::jsonb;

-- Add index for retry processing
CREATE INDEX IF NOT EXISTS idx_schedules_retry_at
ON schedules(next_retry_at)
WHERE status = 'failed' AND retry_count < 3;