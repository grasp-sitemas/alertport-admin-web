#!/usr/bin/env bash
#
# Deploy this repository to a specific Vercel project without disturbing the
# project link stored in .vercel/project.json.
#
# Usage:
#   scripts/deploy.sh admin-alertport
#   scripts/deploy.sh admin-alertport-hml
#
# The script:
#   1. Snapshots the current .vercel/ link (if any)
#   2. Links the repo to the target Vercel project
#   3. Runs `vercel deploy --prod`
#   4. Restores the original .vercel/ link
#
set -euo pipefail

TARGET="${1:-}"
if [ -z "$TARGET" ]; then
  echo "Usage: $0 <vercel-project-name>" >&2
  echo "Known projects: admin-alertport (prod), admin-alertport-hml" >&2
  exit 1
fi

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

BACKUP=""
if [ -d .vercel ]; then
  BACKUP=".vercel.backup-$(date +%s)"
  cp -r .vercel "$BACKUP"
fi

cleanup() {
  rm -rf .vercel
  if [ -n "$BACKUP" ] && [ -d "$BACKUP" ]; then
    mv "$BACKUP" .vercel
  fi
}
trap cleanup EXIT

rm -rf .vercel
vercel link --project "$TARGET" --yes >/dev/null
echo "→ Linked to $TARGET, deploying..."
vercel deploy --prod --yes
