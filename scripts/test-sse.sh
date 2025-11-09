#!/bin/bash
#
# Test SSE endpoint for realtime pipeline events
#

set -e

DASHBOARD_URL="${DASHBOARD_URL:-http://localhost:3000}"
SSE_ENDPOINT="${DASHBOARD_URL}/api/metrics/stream"

echo "🧪 Testing SSE endpoint at: ${SSE_ENDPOINT}"
echo "📡 Press Ctrl+C to stop"
echo ""

# Use curl with -N to disable buffering for SSE
curl -N -H "Accept: text/event-stream" "${SSE_ENDPOINT}" 2>&1 | while IFS= read -r line; do
  # Parse SSE format (lines starting with "data:")
  if [[ $line == data:* ]]; then
    # Extract JSON and pretty print
    json="${line#data:}"
    echo "📨 $(echo "$json" | python3 -m json.tool 2>/dev/null || echo "$json")"
  fi
done
