#!/usr/bin/env bash
set -Eeuo pipefail

stage="preflight"
trap 'code=$?; printf "[deploy] Failed during %s (line %s). No automatic migration recovery or rollback was performed.\n" "$stage" "$LINENO" >&2; exit "$code"' ERR

fail() {
  printf '[deploy] %s\n' "$*" >&2
  exit 1
}

require_tree_access() {
  local path="$1" check_files="${2:-false}" blocked
  [[ -e "$path" ]] || return 0
  blocked=$(find "$path" -type d \( ! -writable -o ! -executable \) -print -quit)
  [[ -z "$blocked" ]] || fail "Directory is not writable/searchable by $(id -un): $blocked. Repair ownership manually; do not use sudo npm or chmod 777."
  if [[ "$check_files" == true ]]; then
    blocked=$(find "$path" -type f ! -writable -print -quit)
    [[ -z "$blocked" ]] || fail "Build output is not writable by $(id -un): $blocked. Repair ownership manually."
  fi
}

revision="${1:-}"
[[ "$revision" =~ ^([a-f0-9]{40}|[a-f0-9]{64})$ ]] || fail "A full tested Git revision is required."
[[ "$(id -u)" != 0 ]] || fail "Deployment must not run as root."
[[ "$(id -un)" == "${DEPLOY_USER:-ramoj745}" ]] || fail "Unexpected deployment user."

for command in git npm npx node find flock sudo systemctl; do
  command -v "$command" >/dev/null || fail "Missing required command: $command"
done

cd -- "${DEPLOY_DIR:-/srv/hans-mobile-api}"
[[ -w . && -x . ]] || fail "Deployment checkout is not writable/searchable."
[[ -d .git ]] || fail "Expected the managed production Git checkout."
require_tree_access .git
for file in .git/FETCH_HEAD .git/index .git/hans-deploy.lock; do
  [[ ! -e "$file" || -w "$file" ]] || fail "Git metadata is not writable: $file"
done

# Keep the checkout, installation, migration and restart under the same host lock.
exec 9> .git/hans-deploy.lock
flock -n 9 || fail "Another deployment is running on this VPS."
[[ "$(git branch --show-current)" == main ]] || fail "Production checkout must remain on main."
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || fail "Tracked files have local changes. Review them; deployment will not reset or overwrite them."

for path in src prisma .github docs scripts node_modules; do
  require_tree_access "$path"
done
require_tree_access src/generated true
require_tree_access dist true
for file in .env.production.local .env.production .env.local .env; do
  [[ ! -e "$file" || -r "$file" ]] || fail "Environment file is not readable: $file"
done

service="${DEPLOY_SERVICE:-hans-api}"
[[ "$(systemctl show "$service" --property=WorkingDirectory --value)" == "$(pwd -P)" ]] || fail "The service WorkingDirectory does not match this checkout."
sudo -n -l -- "$(command -v systemctl)" restart "$service" >/dev/null

stage="fetch tested revision"
git fetch origin main
git merge-base --is-ancestor "$revision" origin/main || fail "Tested revision is not in origin/main."
git merge --ff-only "$revision"
[[ "$(git rev-parse HEAD)" == "$revision" ]] || fail "Checkout is newer than or differs from the tested revision; refusing to deploy a different commit."

stage="install dependencies"
npm ci --include=dev
stage="generate Prisma client"
NODE_ENV=production npx prisma generate
stage="build"
npm run build
node -e 'const fs = require("node:fs"); fs.writeFileSync("dist/deployment.json", JSON.stringify({revision: process.argv[1]}) + "\n", {mode: 0o644}); fs.chmodSync("dist/deployment.json", 0o644);' "$revision"

stage="apply migrations"
NODE_ENV=production npx prisma migrate deploy
stage="verify migration history"
NODE_ENV=production npx prisma migrate status

stage="restart service"
sudo -n systemctl restart "$service"
systemctl is-active --quiet "$service"
stage="verify running revision and database readiness"
NODE_ENV=production node dist/scripts/checkDeploymentReadiness.js "$revision"
printf '[deploy] Successfully deployed and verified %s.\n' "$revision"
