# Production deployment

## Automatic flow

Only pushes to `main` deploy. GitHub Actions uses Node.js 22 to install locked
dependencies, generate the Prisma client, type-check, build and run tests. A
placeholder localhost database URL is used in CI; CI never receives the VPS
database credentials and does not run production migrations itself.

The production concurrency group queues runs rather than cancelling an active
deployment. The tested `scripts/deploy.sh` is passed over SSH as base64 so it can
check the VPS and lock the checkout before fetching, including on the first run
when that checkout does not yet contain this script. The payload contains source
code only, not secrets. `script_stop: true` and Bash strict mode propagate errors.

The VPS script:

1. Requires the deployment user `ramoj745`, never root; checks required tools,
   writable Git/build directories, readable environment files, the service
   working directory and noninteractive restart permission.
2. Locks `.git/hans-deploy.lock` across checkout, build, migrations and restart.
   Rejects a dirty tracked checkout or a branch other than `main`. It never resets
   local changes, repairs ownership automatically or scans/changes uploads.
3. Fetches `origin/main`, verifies the tested SHA belongs to it and fast-forwards
   to that exact SHA. It refuses a newer/different checkout rather than silently
   deploying a commit CI did not test or rolling backwards.
4. Runs `npm ci --include=dev`, Prisma generation and the build as `ramoj745`.
   Compilation succeeds before any migration is attempted. It writes the
   non-secret tested revision to `dist/deployment.json`.
5. Applies committed migrations with `NODE_ENV=production npx prisma migrate
   deploy`, then checks migration status. A failed/blocked migration stops the
   run before restart. There is no automatic `resolve`, reset, db push or seed.
6. Restarts `hans-api`, checks systemd state, then polls the loopback readiness
   endpoint for at most 90 seconds. The API must return the exact tested revision
   and pass a read-only, zero-row check of all expected tables and scalar columns.

Any failure marks the job failed. A failed post-restart readiness check does not
silently claim success and does not automatically roll back database changes.
Inspect the service logs and recover deliberately. This remains an in-place
deployment, not an atomic/zero-downtime release or automatic backup system.

## Environment and ownership

VPS secrets remain in its environment files; deployment never provisions or
overwrites them. Prisma CLI and runtime now share `src/config/env.ts` precedence:
`.env.production.local`, `.env.production`, `.env.local`, then `.env`. Exported
variables take priority. Do not point systemd and CLI at different databases.

Run Git/npm/Prisma as `ramoj745`, without sudo. Use sudo only for administrative
ownership repairs and service management. The configured sudo permission must
allow a noninteractive `systemctl restart hans-api`. Never use `chmod 777`, blanket
ownership changes covering uploads, or forced Git resets to get a green deploy.

Permission errors name the offending path; repair its intended ownership on the
VPS once, then retry. Existing uploads and environment-file permissions remain
under the operator's control.

## Health endpoints

`GET /api/health` keeps its original `200 {"status":"API is up!"}` liveness
response. It does not prove database readiness.

`GET /api/health/ready` returns `200 {"status":"ready","revision":"<sha>"}` or
`503 {"status":"not_ready","revision":"<sha>"}`. Development builds without a
deployment marker return a null revision; production deployment requires an
exact SHA match. The revision is captured at process startup, not re-read while
an older process is still running. This public endpoint returns no records,
credentials, connection strings or internal database errors. Schema probes use
a bounded read-only transaction and LIMIT 0; probes are cached/shared for five
seconds to limit database load.

The readiness metadata assumes the current unmapped `public` table/column
names. A CI contract test requires an update to this check if Prisma database
name/schema mappings are introduced.

## Migration failure recovery

Take a database backup before applying or recovering migrations. Automatic
migration deployment does not mean automatic failure recovery. For `P3009`,
inspect `_prisma_migrations.logs` and the actual schema. Complete or reverse only
the necessary steps, then reconcile that one migration using Prisma's documented
production recovery process. Never blindly mark a failed migration applied.

After recovery, run production migration deployment/status and verify the app.
Do not use `migrate dev`, `migrate reset`, or `db push` on the production database.

## Local verification

```bash
npm run build
npm test
```

The shell tests use disposable folders and mocked Git/npm/Prisma/systemd commands
to exercise permission, checkout, migration, restart and readiness failures.
HTTP/schema readiness tests use injected probes and localhost servers. They do
not start the app's background jobs, send mail, or charge Stripe.
