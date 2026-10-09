#!/usr/bin/env bash
# Copies the server's database into a separate LOCAL database for development and testing.
#
#   npm run db:pull                  # dump the server, restore into hans_server_copy, scrub it
#   npm run db:pull -- --use         # ...and point this checkout at the copy (.env.local)
#   DUMP_FILE=db-dumps/x.dump npm run db:pull   # restore an existing dump; no SSH
#
# Your current local database is never touched; the copy goes into its own database.
# Dumps are written to db-dumps/ and profile pictures to uploads/profile-pictures/; both are
# git-ignored. Customer data is scrubbed by default
# (SCRUB=0 to keep it): customer emails become user-<id>@example.test and push tokens are
# deleted, so local testing cannot email or notify real doctors. Staff (ADMIN, SALES_REP)
# accounts keep their emails so you can still sign in with them.
#
# Settings (environment variables):
#   SERVER      SSH target                 (default adieflores@162.222.203.144)
#   REMOTE_DIR  API checkout on the server (default /srv/hans-mobile-api)
#   LOCAL_DB    local database to (re)create (default hans_server_copy)
#   SCRUB       1 to scrub customer data   (default 1)
set -euo pipefail

SERVER="${SERVER:-adieflores@162.222.203.144}"
REMOTE_DIR="${REMOTE_DIR:-/srv/hans-mobile-api}"
LOCAL_DB="${LOCAL_DB:-hans_server_copy}"
SCRUB="${SCRUB:-1}"
USE_COPY=0
[[ "${1:-}" == "--use" ]] && USE_COPY=1

cd "$(dirname "$0")/.."
fail() { echo "db-pull: $*" >&2; exit 1; }

[[ "$LOCAL_DB" =~ ^[a-z_][a-z0-9_]*$ ]] || fail "LOCAL_DB must be a simple lowercase name."

# Local PostgreSQL client tools: PATH first, then the standard Windows install.
find_tool() {
  if command -v "$1" >/dev/null 2>&1; then command -v "$1"; return; fi
  local dir
  for dir in /c/Program\ Files/PostgreSQL/*/bin; do
    [[ -x "$dir/$1.exe" ]] && { echo "$dir/$1.exe"; return; }
  done
  fail "$1 not found. Install PostgreSQL client tools or add them to PATH."
}
PSQL="$(find_tool psql)"
PG_RESTORE="$(find_tool pg_restore)"

# The local server and credentials come from this checkout's .env.
LOCAL_URL="$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
[[ -n "$LOCAL_URL" ]] || fail "DATABASE_URL not found in .env"
LOCAL_BASE="${LOCAL_URL%%\?*}"
LOCAL_BASE="${LOCAL_BASE%/*}"
[[ "$LOCAL_BASE" =~ @(localhost|127\.0\.0\.1)(:[0-9]+)?$ ]] || fail "Refusing to restore: .env DATABASE_URL is not a localhost database."
COPY_URL="$LOCAL_BASE/$LOCAL_DB"

# 1. Fetch the server database dump and profile pictures in one SSH session (one password
#    prompt), unless a dump file was given. Both come back as a single tar stream.
mkdir -p db-dumps
PICTURES_DIR=""
if [[ -n "${DUMP_FILE:-}" ]]; then
  DUMP="$DUMP_FILE"
  [[ -s "$DUMP" ]] || fail "DUMP_FILE $DUMP is missing or empty."
else
  PULL_DIR="db-dumps/server-$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$PULL_DIR"
  echo "Copying the database and profile pictures from $SERVER ($REMOTE_DIR). Enter the SSH password if asked."
  # The remote script arrives on stdin; the archive comes back on stdout. Read-only on the server.
  if ! ssh "$SERVER" "bash -s -- '$REMOTE_DIR'" <<'REMOTE' | tar -xf - -C "$PULL_DIR"
set -euo pipefail
cd -- "$1"
url=""
for file in .env.production.local .env.production .env.local .env; do
  if [[ -f "$file" ]] && grep -qE '^DATABASE_URL=' "$file"; then
    url="$(grep -E '^DATABASE_URL=' "$file" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
    break
  fi
done
[[ -n "$url" ]] || { echo "DATABASE_URL not found in $1" >&2; exit 1; }
command -v pg_dump >/dev/null || { echo "pg_dump is not installed on the server" >&2; exit 1; }
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
# Prisma adds query options (?schema=...) that pg_dump does not understand.
pg_dump --format=custom --no-owner --no-acl "${url%%\?*}" > "$work/db.dump"
if [[ -d uploads/profile-pictures ]]; then
  tar -cf - -C "$work" db.dump -C "$1" uploads/profile-pictures
else
  tar -cf - -C "$work" db.dump
fi
REMOTE
  then
    rm -rf "$PULL_DIR"
    fail "Server copy failed (see the message above)."
  fi
  DUMP="$PULL_DIR/db.dump"
  [[ -s "$DUMP" ]] || { rm -rf "$PULL_DIR"; fail "Server dump was empty."; }
  PICTURES_DIR="$PULL_DIR/uploads/profile-pictures"
fi
echo "Dump: $DUMP ($(du -h "$DUMP" | cut -f1))"

# 2. Recreate the local copy database and restore into it.
echo "Restoring into local database $LOCAL_DB (your other local databases are untouched)."
"$PSQL" "$LOCAL_BASE/postgres" -v ON_ERROR_STOP=1 -q \
  -c "DROP DATABASE IF EXISTS \"$LOCAL_DB\" WITH (FORCE)" \
  -c "CREATE DATABASE \"$LOCAL_DB\"" \
  || fail "Could not create $LOCAL_DB. The .env database user needs the CREATEDB privilege."
"$PG_RESTORE" --no-owner --no-acl --exit-on-error -d "$COPY_URL" "$DUMP"

# Profile pictures go into this checkout's uploads/ (git-ignored), next to any local ones.
if [[ -n "$PICTURES_DIR" && -d "$PICTURES_DIR" ]]; then
  mkdir -p uploads/profile-pictures
  cp -f "$PICTURES_DIR"/* uploads/profile-pictures/ 2>/dev/null || true
  echo "Profile pictures: $(ls "$PICTURES_DIR" | wc -l | tr -d ' ') copied to uploads/profile-pictures."
fi

# 3. Scrub customer contact data so local testing cannot reach real people.
if [[ "$SCRUB" == "1" ]]; then
  echo "Scrubbing customer emails and push tokens."
  "$PSQL" "$COPY_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
BEGIN;
UPDATE "User" SET email = 'user-' || left(id, 8) || '@example.test' WHERE role IN ('USER', 'MED');
UPDATE "Order" o SET "customerEmail" = u.email FROM "User" u WHERE o."userId" = u.id AND u.role IN ('USER', 'MED');
DELETE FROM "PushToken";
COMMIT;
SQL
fi

# 4. Bring the copy up to this checkout's schema (e.g. migrations not yet deployed).
echo "Applying this checkout's pending migrations to the copy."
if ! DATABASE_URL="$COPY_URL" npx prisma migrate deploy; then
  # The copy's migration history differs from this checkout. Apply the schema difference
  # directly, but only when it adds things: never drop data automatically.
  echo "migrate deploy could not run on the copy; applying the schema difference instead."
  DIFF_SQL="db-dumps/schema-diff-$(date +%Y%m%d-%H%M%S).sql"
  DATABASE_URL="$COPY_URL" npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script     | grep -vE '^(Loaded Prisma config|\[dotenv)' > "$DIFF_SQL"
  if grep -qiE 'DROP' "$DIFF_SQL"; then
    fail "The schema difference would drop data; not applied. Review $DIFF_SQL."
  fi
  if grep -qE '^(CREATE|ALTER)' "$DIFF_SQL"; then
    DATABASE_URL="$COPY_URL" npx prisma db execute --file "$DIFF_SQL"
  fi
  echo "Copy schema matches this checkout."
fi

if [[ "$USE_COPY" == "1" ]]; then
  # .env.local is git-ignored and is read before .env, so it overrides DATABASE_URL.
  touch .env.local
  grep -vE '^DATABASE_URL=' .env.local > .env.local.tmp || true
  echo "DATABASE_URL=\"$COPY_URL\"" >> .env.local.tmp
  mv .env.local.tmp .env.local
  echo "This checkout now uses $LOCAL_DB (.env.local). Restart the API. Remove that line to switch back."
else
  echo "Done. To use the copy, run  npm run db:pull -- --use  next time, or set DATABASE_URL in .env.local"
  echo "to your .env DATABASE_URL with the database name changed to $LOCAL_DB, then restart the API."
fi
