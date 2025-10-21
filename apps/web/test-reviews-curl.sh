#!/bin/bash
cd "$(dirname "$0")"

echo "Getting access token..."
TOKEN=$(pnpm tsx get-token.ts 2>/dev/null | tail -1)

echo "Token: ${TOKEN:0:20}..."
echo ""
echo "Testing Reviews API..."
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://mybusiness.googleapis.com/v4/accounts/108283827725802632530/locations/16919135625305195332/reviews" \
  | python3 -m json.tool
