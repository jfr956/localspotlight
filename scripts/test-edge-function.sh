#!/bin/bash

# Test script for the publish-posts edge function

SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

echo "Testing publish-posts edge function..."
echo ""

curl -v -X POST "http://127.0.0.1:54321/functions/v1/publish-posts" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json"

echo ""
echo ""
echo "Done!"
