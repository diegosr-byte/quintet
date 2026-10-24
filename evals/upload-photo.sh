#!/bin/sh
# Uploads one receipt photo to the current Convex deployment and prints its entry for evals:run's `photos`.
# Usage (from the repo root): evals/upload-photo.sh E07 ~/projects/quintet-receipts/E07.jpg
# Run it once per deployment: storage ids don't carry over between dev and the integration deployment.
set -e
case_id=$1; file=$2
case "$file" in
  *.jpg|*.jpeg) mime=image/jpeg ;; *.png) mime=image/png ;; *.webp) mime=image/webp ;;
  *) echo "Use a JPEG, PNG or WebP (Claude can't read HEIC): $file" >&2; exit 1 ;;
esac
url=$(npx convex run evals:uploadUrl 2>/dev/null | tr -d '"')
id=$(curl -s -X POST -H "Content-Type: $mime" --data-binary @"$file" "$url" | sed 's/.*"storageId":"\([^"]*\)".*/\1/')
echo "\"$case_id\":{\"storageId\":\"$id\",\"mimeType\":\"$mime\"}"
