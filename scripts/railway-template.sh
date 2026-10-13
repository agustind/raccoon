#!/usr/bin/env bash
# Creates the Railway project from .railway/railway.ts, gives the web service a
# public domain, then generates (and optionally publishes) a template from it.
#
#   scripts/railway-template.sh            # project + unpublished template
#   scripts/railway-template.sh --publish  # also publish to the marketplace
#
# Requires: railway CLI >= 5.42.1, logged in (`railway login`), and the repo in
# .railway/railway.ts (REPOSITORY) pushed to GitHub and connected to Railway.
set -euo pipefail

cd "$(dirname "$0")/.."

PROJECT_NAME="${PROJECT_NAME:-raccoon}"

if ! railway status >/dev/null 2>&1; then
  echo "Creating Railway project ${PROJECT_NAME}..."
  railway init --name "${PROJECT_NAME}"
fi

echo "Planning..."
railway config plan

read -r -p "Apply this plan? [y/N] " answer
[[ "${answer}" == "y" || "${answer}" == "Y" ]] || exit 1
railway config apply --yes

echo "Adding a public domain to the web service..."
railway domain --service web || true

echo "Generating template draft..."
template_json="$(railway templates create --json)"
template_id="$(echo "${template_json}" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("id") or d.get("template", {}).get("id", ""))')"
echo "Template draft: ${template_id}"

if [[ "${1:-}" == "--publish" ]]; then
  railway templates publish "${template_id}" \
    --category Observability \
    --description "Self-hosted monitoring for Laravel: requests, jobs, queries and exceptions, sent by the official laravel/nightwatch agent." \
    --readme-file .railway/TEMPLATE.md
fi

echo "Done. Review the template in the Railway dashboard before sharing it."
