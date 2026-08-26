#!/usr/bin/env bash
# Cancel GitHub's branch-source Jekyll workflow so it cannot overwrite a dist/ deploy.
set -euo pipefail

for status in queued in_progress; do
  gh run list --workflow=pages-build-deployment --status="$status" --limit 20 \
    --json databaseId --jq '.[].databaseId' \
  | while read -r id; do
      [ -n "${id:-}" ] || continue
      echo "Canceling pages-build-deployment run $id ($status)"
      gh run cancel "$id" || true
    done
done
