#!/bin/bash
cd "/Users/jason/Cursor/projects/kreativ solutions/localspotlight/apps/web"

# Load environment variables
export $(grep -v '^#' .env.local | xargs)

# Run scheduler for 20 seconds then kill it
node scheduler.js &
PID=$!
sleep 20
kill $PID 2>/dev/null
wait $PID 2>/dev/null
