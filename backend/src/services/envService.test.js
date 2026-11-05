import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { salvaClaudeModello, leggiClaudeModello } from './envService.js';

const cartella = await mkdtemp(path.join(os.tmpdir(), 'env-test-'));
const file = path.join(cartella, 'ai.env');
process.env.FOGLIFATTURE_ENV_PATH = file;

after(async () => {
  delete process.env.FOGLIFATTURE_ENV_PATH;
  await rm(cartella, { recursive: true, force: true });
});

describe('envService con FOGLIFATTURE_ENV_PATH', () => {
  it('scrive e legge nel file indicato dalla variabile', async () => {
    await salvaClaudeModello('modello-prova');
    assert.match(await readFile(file, 'utf-8'), /^CLAUDE_MODEL=modello-prova$/m);
    assert.equal(await leggiClaudeModello(), 'modello-prova');
  });

  it('senza il file il valore è vuoto', async () => {
    process.env.FOGLIFATTURE_ENV_PATH = path.join(cartella, 'assente.env');
    assert.equal(await leggiClaudeModello(), '');
  });
});
