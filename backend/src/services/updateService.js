// Rilevamento/esecuzione aggiornamento app via tag Git semver (vX.Y.Z), provider-agnostico
// (solo comandi `git` puri: funziona identico su Gitea self-hosted oggi e GitHub domani).
// Vedi AI-Workspace/Plans/AUTO_UPDATE_DASHBOARD.md per il disegno completo.
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { logger } from '../lib/logger.js';

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.join(import.meta.dirname, '..', '..', '..');
const VERSION_FILE = path.join(REPO_ROOT, 'backend', 'VERSION');

async function git(args) {
  const { stdout } = await execFileAsync('git', args, { cwd: REPO_ROOT });
  return stdout.trim();
}

function parseSemver(tag) {
  const m = /^v(\d+)\.(\d+)\.(\d+)$/.exec(tag);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

// > 0 se a > b, coerente con Array.prototype.sort.
function confrontaSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

async function versioneLocale() {
  return await readFile(VERSION_FILE, 'utf-8').then(v => v.trim()).catch(() => null);
}

// Tag più recente esistente sul remote e raggiungibile dal branch di produzione (main),
// così un tag creato su un branch feature/hotfix non fa comparire il bottone per errore.
async function tagRemotoPiuRecente() {
  await git(['fetch', '--tags', 'origin', 'main']);
  const righe = await git(['ls-remote', '--tags', '--refs', 'origin']);
  const tagCandidati = righe.split('\n')
    .map(riga => riga.split('refs/tags/')[1])
    .filter(Boolean)
    .filter(tag => parseSemver(tag))
    .sort(confrontaSemver)
    .reverse();

  for (const tag of tagCandidati) {
    try {
      await execFileAsync('git', ['merge-base', '--is-ancestor', tag, 'origin/main'], { cwd: REPO_ROOT });
      return tag; // primo (= più recente) che è antenato di main
    } catch {
      // tag non raggiungibile da main, scartato
    }
  }
  return null;
}

// Note di rilascio: messaggio del tag annotato, nessuna dipendenza da API GitHub Releases.
async function changelogTag(tag) {
  return await git(['tag', '-l', '--format=%(contents)', tag]).catch(() => '');
}

export async function statoAggiornamento() {
  const [remoto, locale] = await Promise.all([
    tagRemotoPiuRecente().catch(err => {
      logger.error('Errore controllo aggiornamenti', { errore: err.message });
      return null;
    }),
    versioneLocale(),
  ]);
  const disponibile = Boolean(remoto && (!locale || confrontaSemver(remoto, locale) > 0));
  const changelog = disponibile ? await changelogTag(remoto) : '';
  return { disponibile, versioneLocale: locale, versioneRemota: remoto, changelog };
}

let updateInCorso = false;

// Lancia lo script di update nativo per la piattaforma (scripts/update.sh o update.ps1):
// fetch tag, checkout, install/build, scrittura VERSION, poi termina il processo Node —
// launchd (Mac) / Scheduled Task (Windows) lo rilanciano da soli con la nuova build.
export function avviaAggiornamento(tagRemoto) {
  if (updateInCorso) return { avviato: false, motivo: 'Aggiornamento già in corso' };
  updateInCorso = true;

  const script = process.platform === 'win32'
    ? { cmd: 'powershell', args: ['-ExecutionPolicy', 'Bypass', '-File', path.join(REPO_ROOT, 'scripts', 'update.ps1'), tagRemoto, String(process.pid)] }
    : { cmd: 'bash', args: [path.join(REPO_ROOT, 'scripts', 'update.sh'), tagRemoto, String(process.pid)] };

  logger.info('Avvio aggiornamento', { tag: tagRemoto, script: script.cmd });
  const proc = spawn(script.cmd, script.args, { cwd: REPO_ROOT, detached: true, stdio: 'ignore' });
  proc.unref();
  proc.on('exit', () => { updateInCorso = false; });

  return { avviato: true };
}
