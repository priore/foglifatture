import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const hooksDir = dirname(fileURLToPath(import.meta.url));

function repo({ remote = 'https://github.com/x/y.git', privato = '' } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'hooks-'));
  const sh = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'pipe' });
  sh('init', '-q'); sh('config', 'user.email', 'pub@users.noreply.github.com'); sh('config', 'user.name', 'pub');
  if (remote) sh('remote', 'add', 'origin', remote);
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  cpSync(hooksDir, join(dir, 'scripts/git-hooks'), { recursive: true });
  const priv = join(dir, '..', `priv-${Date.now()}-${Math.random()}`);
  writeFileSync(priv, privato);
  return { dir, sh, env: { ...process.env, FOGLIFATTURE_PRIVATE_PATTERNS: priv, FOGLIFATTURE_HOOKS_MODE: 'auto' } };
}
function stageAndRun(r, file, content) {
  writeFileSync(join(r.dir, file), content);
  r.sh('add', '-f', file);
  return spawnSync('sh', [join(r.dir, 'scripts/git-hooks/pre-commit')], { cwd: r.dir, env: r.env, encoding: 'utf8' });
}

test('commit pulito passa', () => {
  const r = repo();
  assert.equal(stageAndRun(r, 'a.txt', 'ciao\n').status, 0);
  rmSync(r.dir, { recursive: true });
});
test('file .env bloccato', () => {
  const r = repo();
  assert.equal(stageAndRun(r, '.env', 'X=1\n').status, 1);
});
test('path assoluto utente bloccato su remote github', () => {
  const r = repo();
  assert.equal(stageAndRun(r, 'a.txt', 'cd /Users/mario/progetti\n').status, 1);
});
test('marker hooks:allow lascia passare', () => {
  const r = repo();
  assert.equal(stageAndRun(r, 'a.txt', 'cd /Users/mario/x # hooks:allow\n').status, 0);
});
test('senza remote github nulla viene bloccato (repo privato)', () => {
  const r = repo({ remote: '' });
  assert.equal(stageAndRun(r, 'a.txt', 'cd /Users/mario/x\n').status, 0);
  assert.equal(stageAndRun(r, '.env', 'X=1\n').status, 0);
});
test('pattern privato bloccato', () => {
  const r = repo({ privato: 'NomeSegreto\n' });
  assert.equal(stageAndRun(r, 'a.txt', 'ciao NomeSegreto\n').status, 1);
});
test('pre-push blocca identita non consentita', () => {
  const r = repo({ privato: 'identity: Pub <pub@users.noreply.github.com>\n' });
  r.sh('config', 'user.email', 'privata@example.com');
  writeFileSync(join(r.dir, 'a.txt'), 'x\n'); r.sh('add', 'a.txt');
  r.env.FOGLIFATTURE_HOOKS_MODE = 'off';
  r.sh('commit', '-q', '-m', 'x');
  r.env.FOGLIFATTURE_HOOKS_MODE = 'auto';
  const sha = r.sh('rev-parse', 'HEAD').toString().trim();
  const out = spawnSync('sh', [join(r.dir, 'scripts/git-hooks/pre-push'), 'origin', 'https://github.com/x/y.git'], {
    cwd: r.dir, env: r.env, encoding: 'utf8', input: `refs/heads/main ${sha} refs/heads/main ${'0'.repeat(40)}\n`,
  });
  assert.equal(out.status, 1);
});
