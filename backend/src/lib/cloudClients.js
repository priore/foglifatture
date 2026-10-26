// Identificativi delle app registrate dallo sviluppatore presso Dropbox, Microsoft e Google (una per provider, uguali
// per tutti gli utenti). L'utente finale non registra nulla: fa solo il login al proprio account.
// Ordine di ricerca, per ogni provider:
//   1. variabili d'ambiente FOGLIFATTURE_CLOUD_<PROVIDER>_CLIENT_ID e _CLIENT_SECRET (prove);
//   2. file `backend/cloud-clients.json` (percorso diverso con FOGLIFATTURE_CLOUD_CLIENTS), NON versionato; negli ambienti
//      embedded il contenuto lo passa l'host da una risorsa del bundle (`globalThis.__cloudClienti`). Stessa forma per
//      tutti i provider: { clientId, clientSecret } (il formato `installed` scaricato da Google è comunque letto);
//   3. le costanti qui sotto, versionate: vuote, si riempiono solo per una distribuzione che le deve contenere.
// Un provider senza client ID non è disponibile e non compare nell'app. Con PKCE il client ID non è riservato.
import { readFileSync } from 'node:fs';
import path from 'node:path';

const COSTANTI = {
  dropbox: { clientId: '' },
  onedrive: { clientId: '' },
  google: { clientId: '', clientSecret: '' },
};

function leggiFile() {
  if (globalThis.__cloudClienti) return globalThis.__cloudClienti;
  const file = globalThis.process?.env?.FOGLIFATTURE_CLOUD_CLIENTS || path.join(import.meta.dirname, '..', '..', 'cloud-clients.json');
  try {
    return JSON.parse(readFileSync(file, 'utf-8'));
  } catch {
    return {};
  }
}

export function clientCloud(provider) {
  const env = (campo) => globalThis.process?.env?.[`FOGLIFATTURE_CLOUD_${provider.toUpperCase()}_${campo}`];
  const voce = leggiFile()[provider] ?? {};
  const file = voce.installed ?? voce.web ?? voce; // formato scaricato da Google, oppure { clientId, clientSecret }
  const base = COSTANTI[provider] ?? {};
  return {
    clientId: env('CLIENT_ID') || file.client_id || file.clientId || base.clientId || '',
    clientSecret: env('CLIENT_SECRET') || file.client_secret || file.clientSecret || base.clientSecret || undefined,
  };
}
