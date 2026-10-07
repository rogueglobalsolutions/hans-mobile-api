const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const script = path.join(__dirname, 'deploy.sh');
const revision = 'a'.repeat(40);

function fixture(scenario = 'success', encoded = false) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'hans-deploy-test-')));
  const bin = path.join(root, 'bin');
  for (const folder of ['bin', '.git', 'src/generated/prisma', 'prisma', '.github', 'docs', 'scripts', 'node_modules', 'dist']) {
    fs.mkdirSync(path.join(root, folder), { recursive: true });
  }
  const log = path.join(root, 'commands.jsonl');
  for (const command of ['git', 'npm', 'npx', 'node', 'find', 'flock', 'sudo', 'systemctl', 'id']) {
    fs.writeFileSync(path.join(bin, command), `#!${process.execPath}
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const command = ${JSON.stringify(command)};
const args = process.argv.slice(2);
const scenario = process.env.MOCK_SCENARIO;
fs.appendFileSync(process.env.MOCK_LOG, JSON.stringify({command, args}) + '\\n');
const joined = args.join(' ');
if (command === 'id') { console.log(args[0] === '-u' ? (scenario === 'root' ? '0' : '1000') : 'ramoj745'); }
if (command === 'find' && args[0] === 'dist' && scenario === 'permissions') console.log('dist/blocked');
if (command === 'flock' && scenario === 'locked') process.exit(1);
if (command === 'git') {
  if (args[0] === 'branch') console.log(scenario === 'branch' ? 'test-branch' : 'main');
  if (args[0] === 'status' && scenario === 'dirty') console.log(' M prisma/data/all_products.json');
  if (args[0] === 'fetch' && scenario === 'fetch') process.exit(1);
  if (args[0] === 'merge-base' && scenario === 'untrusted') process.exit(1);
  if (args[0] === 'rev-parse') console.log(scenario === 'revision' ? 'b'.repeat(40) : process.env.MOCK_REVISION);
}
if (command === 'npm' && ((args[0] === 'ci' && scenario === 'install') || (joined === 'run build' && scenario === 'build'))) process.exit(1);
if (command === 'npx' && ((joined === 'prisma generate' && scenario === 'generate') || (joined === 'prisma migrate deploy' && scenario === 'migration') || (joined === 'prisma migrate status' && scenario === 'migration-status'))) process.exit(1);
if (command === 'systemctl' && args[0] === 'show') console.log(scenario === 'workdir' ? '/wrong-checkout' : process.env.DEPLOY_DIR);
if (command === 'systemctl' && args[0] === 'is-active' && scenario === 'inactive') process.exit(1);
if (command === 'sudo' && args.includes('-l') && scenario === 'sudo') process.exit(1);
if (command === 'sudo' && args.includes('restart') && !args.includes('-l') && scenario === 'restart') process.exit(1);
if (command === 'node' && args[0] === '-e') {
  const result = spawnSync(process.execPath, args, {stdio: 'inherit'});
  process.exit(result.status ?? 1);
}
if (command === 'node' && args[0] !== '-e' && scenario === 'readiness') process.exit(1);
`, { mode: 0o755 });
  }
  const workflow = fs.readFileSync(path.join(__dirname, '..', '.github/workflows/deploy.yml'), 'utf8');
  const wrapper = workflow.match(/^ {10}script: \|\n((?: {12}.*(?:\n|$))*)/m)?.[1].replace(/^ {12}/gm, '');
  assert.ok(wrapper, 'The tested SSH wrapper must exist in the workflow.');
  const result = spawnSync('/bin/bash', encoded ? ['-o', 'pipefail', '-c', wrapper] : [script, revision], {
    env: { ...process.env, PATH: bin + path.delimiter + process.env.PATH,
      DEPLOY_DIR: root, DEPLOY_USER: 'ramoj745', DEPLOY_SHA: revision,
      DEPLOY_SCRIPT: fs.readFileSync(script).toString('base64'),
      MOCK_SCENARIO: scenario, MOCK_LOG: log, MOCK_REVISION: revision },
    encoding: 'utf8', timeout: 20_000,
  });
  return { root, result, commands: fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [],
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

const restarted = commands => commands.some(({command, args}) => command === 'sudo' && args.includes('restart') && !args.includes('-l'));
const migrated = commands => commands.some(({command, args}) => command === 'npx' && args.join(' ') === 'prisma migrate deploy');
const reached = (commands, command, prefix) => commands.some(call => call.command === command && call.args.slice(0, prefix.length).join(' ') === prefix.join(' '));

test('deployment script is valid Bash and does not contain destructive recovery commands', () => {
  const syntax = spawnSync('/bin/bash', ['-n', script], {encoding: 'utf8'});
  assert.equal(syntax.status, 0, syntax.stderr);
  const text = fs.readFileSync(script, 'utf8');
  assert.doesNotMatch(text, /^\s*(?:(?:NODE_ENV=\S+\s+)?(?:npx\s+)?prisma (?:migrate (?:reset|dev|resolve)|db push)|git (?:reset|checkout --)|sudo (?:npm|npx)|(?:sudo\s+)?chown|chmod 777)\b/m);
});

test('successful deployment locks before checkout and builds before migrations/restart', () => {
  const state = fixture();
  try {
    assert.equal(state.result.status, 0, state.result.stderr);
    const calls = state.commands.map(({command, args}) => command + ' ' + args.join(' '));
    assert.ok(calls.indexOf('flock -n 9') < calls.indexOf('git fetch origin main'));
    assert.ok(calls.includes('git merge --ff-only ' + revision));
    assert.ok(calls.indexOf('npm run build') < calls.indexOf('npx prisma migrate deploy'));
    assert.ok(calls.indexOf('npx prisma migrate status') < calls.indexOf('sudo -n systemctl restart hans-api'));
    assert.ok(calls.indexOf('sudo -n systemctl restart hans-api') < calls.indexOf('node dist/scripts/checkDeploymentReadiness.js ' + revision));
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(state.root, 'dist/deployment.json'), 'utf8')), {revision});
    assert.match(state.result.stdout, /Successfully deployed and verified/);
  } finally { state.cleanup(); }
});

for (const scenario of ['root', 'locked', 'branch', 'dirty', 'permissions', 'workdir', 'sudo', 'fetch', 'untrusted', 'revision', 'install', 'generate', 'build']) {
  test(`failure at ${scenario} prevents database migrations and restart`, () => {
    const state = fixture(scenario);
    try {
      assert.equal(state.result.status, 1, state.result.stdout + state.result.stderr);
      const failureCommand = {
        root: ['id', ['-u']], locked: ['flock', ['-n']], branch: ['git', ['branch']],
        dirty: ['git', ['status']], permissions: ['find', ['dist']], workdir: ['systemctl', ['show']],
        sudo: ['sudo', ['-n', '-l']], fetch: ['git', ['fetch']], untrusted: ['git', ['merge-base']],
        revision: ['git', ['rev-parse']], install: ['npm', ['ci']], generate: ['npx', ['prisma', 'generate']],
        build: ['npm', ['run', 'build']],
      }[scenario];
      assert.ok(reached(state.commands, ...failureCommand), `Must reach the intended ${scenario} failure.`);
      assert.equal(migrated(state.commands), false);
      assert.equal(restarted(state.commands), false);
    } finally { state.cleanup(); }
  });
}

for (const scenario of ['migration', 'migration-status']) {
  test(`${scenario} failure prevents service restart`, () => {
    const state = fixture(scenario);
    try {
      assert.equal(state.result.status, 1);
      assert.equal(migrated(state.commands), true);
      if (scenario === 'migration-status') assert.ok(reached(state.commands, 'npx', ['prisma', 'migrate', 'status']));
      assert.equal(restarted(state.commands), false);
    } finally { state.cleanup(); }
  });
}

for (const scenario of ['restart', 'inactive', 'readiness']) {
  test(`${scenario} failure never reports success or attempts automatic rollback`, () => {
    const state = fixture(scenario);
    try {
      assert.equal(state.result.status, 1);
      assert.equal(restarted(state.commands), true);
      if (scenario === 'inactive') assert.ok(reached(state.commands, 'systemctl', ['is-active']));
      if (scenario === 'readiness') assert.ok(reached(state.commands, 'node', ['dist/scripts/checkDeploymentReadiness.js']));
      assert.doesNotMatch(state.result.stdout, /Successfully deployed/);
      assert.equal(state.commands.some(({args}) => args.includes('resolve') || args.includes('reset')), false);
    } finally { state.cleanup(); }
  });
}

for (const scenario of ['success', 'build', 'migration']) {
  test(`the actual encoded SSH wrapper propagates ${scenario}`, () => {
    const state = fixture(scenario, true);
    try {
      assert.equal(state.result.status, scenario === 'success' ? 0 : 1, state.result.stderr);
      assert.ok(reached(state.commands, 'npm', ['run', 'build']));
      assert.equal(restarted(state.commands), scenario === 'success');
    } finally { state.cleanup(); }
  });
}
