// Catalogo dei template di stampa (fattura/timesheet). In questa fase esistono solo i
// template default preinstallati sotto templates-default/ (path versionata, git-tracked).
// Import/eliminazione di template custom in data/templates/ arriveranno con l'import via UI.
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const TEMPLATES_DEFAULT_DIR = path.join(import.meta.dirname, '..', 'templates-default');

async function leggiTemplate(id) {
  const dir = path.join(TEMPLATES_DEFAULT_DIR, id);
  const [layoutHtml, layoutCss, templateJson] = await Promise.all([
    readFile(path.join(dir, 'layout.html'), 'utf-8'),
    readFile(path.join(dir, 'layout.css'), 'utf-8'),
    readFile(path.join(dir, 'template.json'), 'utf-8'),
  ]);
  return { ...JSON.parse(templateJson), layoutHtml, layoutCss, preinstallato: true };
}

export async function listTemplates(tipo) {
  const ids = await readdir(TEMPLATES_DEFAULT_DIR).catch((err) => {
    if (err.code === 'ENOENT') return [];
    throw err;
  });
  const templates = await Promise.all(ids.map(leggiTemplate));
  return tipo ? templates.filter((t) => t.tipo === tipo) : templates;
}

export async function getTemplate(id) {
  return leggiTemplate(id).catch((err) => {
    if (err.code === 'ENOENT') return null;
    throw err;
  });
}
