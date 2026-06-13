#!/usr/bin/env bash
# eas-rollback.sh — Roll back a broken OTA update on any EAS channel.
#
# Usage:
#   ./scripts/eas-rollback.sh [channel] [update-group-id]
#
# Arguments:
#   channel          EAS channel to roll back (default: production)
#   update-group-id  The known-good update group ID to republish to the channel.
#                    If omitted, the script lists recent updates so you can pick one.
#
# Examples:
#   ./scripts/eas-rollback.sh
#       → lists recent updates on "production"; no changes made
#
#   ./scripts/eas-rollback.sh preview
#       → lists recent updates on "preview"; no changes made
#
#   ./scripts/eas-rollback.sh production abc123-update-group-id
#       → republishes that update group to the "production" channel immediately
#
# Prerequisites:
#   - EXPO_TOKEN env var set (or already authenticated via `eas login`)
#   - eas-cli available via npx (no global install needed)
#   - Run from the repo root

set -euo pipefail

CHANNEL="${1:-production}"
UPDATE_GROUP_ID="${2:-}"

MOBILE_DIR="$(cd "$(dirname "$0")/../artifacts/mobile" && pwd)"

echo "========================================"
echo " EAS Rollback — channel: $CHANNEL"
echo "========================================"

if [[ -z "$UPDATE_GROUP_ID" ]]; then
  echo ""
  echo "No update group ID supplied."
  echo "Listing the 10 most recent updates on '$CHANNEL' so you can pick a known-good one..."
  echo ""
  (cd "$MOBILE_DIR" && npx eas-cli update:list --branch "$CHANNEL" --limit 10 --non-interactive)
  echo ""
  echo "Re-run with the update group ID of the last known-good update:"
  echo ""
  echo "  ./scripts/eas-rollback.sh $CHANNEL <update-group-id>"
  echo ""
  echo "No changes were made."
  exit 0
fi

echo ""
echo "Republishing update group '$UPDATE_GROUP_ID' to channel '$CHANNEL'..."
echo ""

# `eas update:republish` re-points the target channel to an existing update group
# without re-bundling any code. This is the fastest, safest rollback path.
(cd "$MOBILE_DIR" && npx eas-cli update:republish \
  --group "$UPDATE_GROUP_ID" \
  --branch "$CHANNEL" \
  --non-interactive)

echo ""
echo "Done. Channel '$CHANNEL' now serves update group $UPDATE_GROUP_ID."
echo "Devices will pick up the rolled-back bundle on their next launch."
echo ""
echo "When you have shipped a proper fix and want to resume normal deploys,"
echo "just push to the relevant branch — the CI workflow will publish a fresh update."
