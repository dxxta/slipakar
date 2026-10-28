#!/bin/sh
set -eu

# Garage bootstrap script for single-node cluster
# Configures layout, imports S3 API key, creates S3 bucket, and grants permissions.
# Uses Garage Admin HTTP API v1 with Bearer token authentication.

GARAGE_HOST="${GARAGE_HOST:-garage}"
ADMIN_PORT="${ADMIN_PORT:-3903}"
ADMIN_BASE_URL="http://${GARAGE_HOST}:${ADMIN_PORT}"

if [ -z "${GARAGE_ADMIN_TOKEN:-}" ]; then
  echo "Error: GARAGE_ADMIN_TOKEN is required." >&2
  exit 1
fi

if [ -z "${S3_ACCESS_KEY:-}" ]; then
  echo "Error: S3_ACCESS_KEY is required." >&2
  exit 1
fi

if [ -z "${S3_SECRET_KEY:-}" ]; then
  echo "Error: S3_SECRET_KEY is required." >&2
  exit 1
fi

S3_BUCKET="${S3_BUCKET:-lokaslip}"

echo "Waiting for Garage admin API to be ready at ${ADMIN_BASE_URL}..."
MAX_ATTEMPTS=30
ATTEMPT=0
STATUS_RESPONSE=""

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  ATTEMPT=$((ATTEMPT + 1))
  STATUS_RESPONSE=$(curl -s -f -H "Authorization: Bearer ${GARAGE_ADMIN_TOKEN}" "${ADMIN_BASE_URL}/v1/status" 2>/dev/null || true)
  if [ -n "$STATUS_RESPONSE" ]; then
    echo "Garage admin API responded."
    break
  fi
  sleep 1
done

if [ -z "$STATUS_RESPONSE" ]; then
  echo "Error: Timed out waiting for Garage admin API." >&2
  exit 1
fi

# Extract node ID from status response
# JSON format: {"node":"<64-hex-id>", ...}
NODE_ID=$(echo "$STATUS_RESPONSE" | sed -n 's/.*"node"[[:space:]]*:[[:space:]]*"\([a-f0-9]*\)".*/\1/p')

if [ -z "$NODE_ID" ]; then
  echo "Error: Could not extract node ID from status response." >&2
  exit 1
fi

echo "Garage node ID: ${NODE_ID}"

# Step 1: Configure layout if not yet configured
# POST /v1/layout
echo "Configuring layout..."
curl -s -f -X POST "${ADMIN_BASE_URL}/v1/layout" \
  -H "Authorization: Bearer ${GARAGE_ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "[{\"id\":\"${NODE_ID}\",\"zone\":\"dc1\",\"capacity\":10737418240,\"tags\":[]}]" > /dev/null || true

# Step 2: Apply layout
# POST /v1/layout/apply
echo "Applying layout..."
curl -s -f -X POST "${ADMIN_BASE_URL}/v1/layout/apply" \
  -H "Authorization: Bearer ${GARAGE_ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"version":1}' > /dev/null || true

# Step 3: Import S3 Access Key
# POST /v1/key/import
echo "Importing S3 API access key..."
KEY_PAYLOAD=$(printf '{"name":"lokaslip-key","accessKeyId":"%s","secretAccessKey":"%s"}' "$S3_ACCESS_KEY" "$S3_SECRET_KEY")
curl -s -f -X POST "${ADMIN_BASE_URL}/v1/key/import" \
  -H "Authorization: Bearer ${GARAGE_ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$KEY_PAYLOAD" > /dev/null || true

# Step 4: Ensure S3 bucket exists and retrieve its ID
# POST /v1/bucket
echo "Ensuring S3 bucket '${S3_BUCKET}' exists..."
BUCKET_PAYLOAD=$(printf '{"globalAlias":"%s"}' "$S3_BUCKET")
BUCKET_RESP=$(curl -s -X POST "${ADMIN_BASE_URL}/v1/bucket" \
  -H "Authorization: Bearer ${GARAGE_ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$BUCKET_PAYLOAD" 2>/dev/null || true)

BUCKET_ID=$(echo "$BUCKET_RESP" | sed -n 's/.*"id"[[:space:]]*:[[:space:]]*"\([a-f0-9]*\)".*/\1/p')

if [ -z "$BUCKET_ID" ]; then
  # If bucket already existed, query it by alias: GET /v1/bucket?alias=<S3_BUCKET>
  BUCKET_INFO=$(curl -s -f -H "Authorization: Bearer ${GARAGE_ADMIN_TOKEN}" "${ADMIN_BASE_URL}/v1/bucket?alias=${S3_BUCKET}" 2>/dev/null || true)
  BUCKET_ID=$(echo "$BUCKET_INFO" | sed -n 's/.*"id"[[:space:]]*:[[:space:]]*"\([a-f0-9]*\)".*/\1/p')
fi

if [ -z "$BUCKET_ID" ]; then
  echo "Error: Could not retrieve ID for bucket '${S3_BUCKET}'." >&2
  exit 1
fi

# Step 5: Grant read/write/owner permissions for key on bucket
# POST /v1/bucket/allow
echo "Granting bucket permissions for key..."
ALLOW_PAYLOAD=$(printf '{"bucketId":"%s","accessKeyId":"%s","permissions":{"read":true,"write":true,"owner":true}}' "$BUCKET_ID" "$S3_ACCESS_KEY")
curl -s -f -X POST "${ADMIN_BASE_URL}/v1/bucket/allow" \
  -H "Authorization: Bearer ${GARAGE_ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$ALLOW_PAYLOAD" > /dev/null || true

echo "Garage bootstrap completed successfully."
