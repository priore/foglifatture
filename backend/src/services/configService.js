// Gestione configurazione: anagrafica fornitore, clienti, tariffa oraria, dati PEC/SDI.
// Un unico file config.json salvato nella root dei dati.
import { randomUUID } from 'node:crypto';
import { rename, readdir, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import keytar from 'keytar';
import { readJson, writeJson, DATA_DIR, setDataDir } from '../lib/jsonStore.js';

const CONFIG_FILE = 'config.json';

// Password sensibili (pec.passwordMittente, backup.password) non vengono mai scritte in
// config.json: risiedono nel Keychain OS (keytar) e vengono iniettate in memoria da
// getConfig(). Il service, non conta account: un solo utente per installazione.
const KEYTAR_SERVICE = 'Timesheet-Fatturazione';
const KEYTAR_ACCOUNT_PEC = 'pec.passwordMittente';
const KEYTAR_ACCOUNT_BACKUP = 'backup.password';
// Placeholder restituito al frontend al posto della password reale quando una password è
// già salvata nel Keychain: il campo GET non deve mai esporre il segreto in chiaro via HTTP.
const PASSWORD_PLACEHOLDER = '••••••••';

const DEFAULT_CONFIG = {
  fornitore: {
    denominazione: '',
    indirizzo: '',
    numeroCivico: '',
    cap: '',
    comune: '',
    provincia: '',
    partitaIva: '',
    codiceFiscale: '',
    regimeFiscale: 'RF19',
    logoDataUrl: '', // logo mostrato nella stampa PDF della Fattura Pro-Forma
  },
  // Elenco clienti (supporto multi-cliente concorrente): ogni cliente ha un id stabile
  // e la propria tariffa oraria. "attivo:false" è cancellazione logica (nascosto dai
  // selettori UI, ma resta risolvibile per fatture/timesheet storici già emessi).
  clienti: [],
  fatturazione: {
    sogliaBolloVirtuale: 77.47,
    importoBollo: 2.00,
  },
  pec: {
    smtpHost: '',
    smtpPort: 465,
    smtpSecure: true,
    casellaMittente: '',
    passwordMittente: '',
    destinatarioSdi: 'sdi01@pec.fatturapa.it',
    // Stessa casella PEC, lato ricezione: usata per il polling automatico delle
    // ricevute/notifiche SDI (RC, NS, MC, NE, EC, DT) e della fattura firmata.
    imapHost: '',
    imapPort: 993,
    imapSecure: true,
  },
  sdi: {
    // Cartella locale in cui salvare XML/ricevute scaricate dalla PEC (es. una
    // cartella dentro Dropbox sincronizzata da Finder, per averle sempre a portata).
    percorsoArchivio: '',
    intervalloPollingMinuti: 15,
    pollingAbilitato: true, // flag on/off del controllo automatico ricevute SDI via IMAP
  },
  backup: {
    // Backup automatico cifrato di backend/data/. La password è salvata in chiaro qui
    // (stesso livello di sicurezza già accettato per pec.passwordMittente) perché
    // serve al processo per cifrare senza intervento utente ad ogni giro.
    abilitato: false,
    percorsoDestinazione: '',
    intervalloOreMinuti: 1440, // default: una volta al giorno
    password: '',
  },
  reminder: {
    // Promemoria: avvisa solo l'ultimo giorno lavorativo del mese (non ogni giorno) se
    // ci sono giorni feriali senza ore registrate né stato di assenza.
    abilitato: false,
    ultimaNotifica: '', // "YYYY-MM-DD" dell'ultimo avviso inviato, evita doppi avvisi nello stesso giorno
  },
  forfettario: {
    sogliaAnnua: 85000, // tetto di fatturato annuo del regime forfettario
    codiceAteco: '', // codice da backend/src/data/atecoSettori.json (es. "62.01.00")
    settoreAteco: '', // nome del settore/sub-settore associato al codice selezionato
    coefficenteRedditivita: 0, // % di redditività del settore selezionato (0-100)
    dataInizioAttivita: '', // "YYYY-MM-DD": aliquota 5% nei primi 5 anni di attività, poi 15%
  },
  dati: {
    // Override di backend/data/, es. una cartella sincronizzata (Dropbox/iCloud/OneDrive)
    // per avere timesheet e fatture su più macchine. Vuoto = default (data/ nel progetto).
    percorso: '',
  },
};

// Fonde una sezione salvata con i suoi default: se in futuro aggiungiamo un nuovo campo
// a una sezione (es. sdi.pollingAbilitato), i config.json già salvati su disco lo ricevono
// comunque invece di perderlo per via di uno spread shallow che sovrascrive l'intera sezione.
function fondiSezione(default_, salvata) {
  return { ...default_, ...(salvata ?? {}) };
}

const CLIENTE_VUOTO = {
  id: '',
  attivo: true,
  denominazione: '',
  indirizzo: '',
  cap: '',
  comune: '',
  provincia: '',
  partitaIva: '',
  codiceDestinatarioSdi: '',
  logoDataUrl: '',
  tariffaOraria: 0,
  email: '', // una o più email separate da virgola, destinatarie di timesheet/fattura via mailto
  figura: '', // campo header PDF timesheet
  commessa: '', // campo header PDF timesheet
  clientePdf: '', // campo header PDF timesheet (etichetta "Cliente", distinta da denominazione)
  progetto: '', // campo header PDF timesheet
  templateFatturaId: null, // null = usa il template fallback fattura-default
  templateTimesheetId: null, // null = usa il template fallback timesheet-default
};

// Elenco clienti salvato: fonde ogni cliente coi campi di default (stesso motivo di
// fondiSezione, per campo nuovo aggiunto in futuro), garantendo sempre id e attivo.
// Se l'elenco è vuoto, sintetizza un cliente dal vecchio formato a cliente singolo
// (config.cliente + config.fatturazione.tariffaOraria) se presente su disco — pura
// normalizzazione in lettura, non riscrive il file finché non arriva un saveConfig.
function fondiClienti(salvati, vecchioClienteSingolo, vecchiaTariffaOraria) {
  if (Array.isArray(salvati) && salvati.length > 0) {
    return salvati.map((c) => ({ ...CLIENTE_VUOTO, ...c, id: c.id || randomUUID() }));
  }
  if (vecchioClienteSingolo?.denominazione || vecchioClienteSingolo?.partitaIva) {
    return [{
      ...CLIENTE_VUOTO,
      ...vecchioClienteSingolo,
      id: randomUUID(),
      tariffaOraria: vecchiaTariffaOraria ?? 0,
    }];
  }
  return [{ ...CLIENTE_VUOTO, id: randomUUID() }];
}

// Uso interno (pecService, sdiRicevuteService, backupService): password reali iniettate
// dal Keychain OS, mai lette da config.json (che le tiene sempre vuote per retrocompatibilità
// e migrazione automatica di installazioni precedenti a questa modifica).
export async function getConfig() {
  const config = await readJson(CONFIG_FILE, null);
  const base = config
    ? {
      ...DEFAULT_CONFIG,
      ...config,
      fornitore: fondiSezione(DEFAULT_CONFIG.fornitore, config.fornitore),
      clienti: fondiClienti(config.clienti, config.cliente, config.fatturazione?.tariffaOraria),
      fatturazione: fondiSezione(DEFAULT_CONFIG.fatturazione, config.fatturazione),
      pec: fondiSezione(DEFAULT_CONFIG.pec, config.pec),
      sdi: fondiSezione(DEFAULT_CONFIG.sdi, config.sdi),
      backup: fondiSezione(DEFAULT_CONFIG.backup, config.backup),
      reminder: fondiSezione(DEFAULT_CONFIG.reminder, config.reminder),
      forfettario: fondiSezione(DEFAULT_CONFIG.forfettario, config.forfettario),
      dati: fondiSezione(DEFAULT_CONFIG.dati, config.dati),
    }
    : { ...DEFAULT_CONFIG, clienti: fondiClienti([]) };

  // Migrazione automatica: se una password è ancora in chiaro in config.json (installazione
  // precedente a keytar), spostala nel Keychain al primo avvio e ripulisci il file su disco.
  if (base.pec.passwordMittente) {
    await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_PEC, base.pec.passwordMittente);
    await writeJson(CONFIG_FILE, { ...(config ?? base), pec: { ...base.pec, passwordMittente: '' } });
  }
  if (base.backup.password) {
    await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_BACKUP, base.backup.password);
    await writeJson(CONFIG_FILE, { ...(config ?? base), backup: { ...base.backup, password: '' } });
  }

  const [passwordMittente, backupPassword] = await Promise.all([
    keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_PEC),
    keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_BACKUP),
  ]);

  return {
    ...base,
    pec: { ...base.pec, passwordMittente: passwordMittente || '' },
    backup: { ...base.backup, password: backupPassword || '' },
  };
}

// Uso da GET /api/config (frontend): le password reali non vengono mai esposte via HTTP,
// solo un placeholder se una password è già salvata nel Keychain, o stringa vuota altrimenti.
export async function getConfigSicura() {
  const config = await getConfig();
  return {
    ...config,
    pec: { ...config.pec, passwordMittente: config.pec.passwordMittente ? PASSWORD_PLACEHOLDER : '' },
    backup: { ...config.backup, password: config.backup.password ? PASSWORD_PLACEHOLDER : '' },
  };
}

// Stesse regole del frontend (useValidazioneFiscale.js): validazione formale, non di
// congruità. Riga di difesa server-side indipendente dal client, non duplicazione superflua.
const REGEX_PIVA = /^\d{11}$/;
const REGEX_CF_PERSONA_FISICA = /^[A-Za-z]{6}\d{2}[A-Za-z]\d{2}[A-Za-z]\d{3}[A-Za-z]$/;
const REGEX_CODICE_SDI = /^[A-Za-z0-9]{7}$/;
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function campoValido(valore, regex) {
  const v = String(valore || '').trim();
  return v === '' || regex.test(v);
}

export function validaConfig(partialConfig) {
  const errori = [];
  const piva = (sezione, dati) => {
    if (dati?.partitaIva !== undefined && !campoValido(dati.partitaIva, REGEX_PIVA)) {
      errori.push(`${sezione}: Partita IVA deve essere di 11 cifre numeriche`);
    }
  };
  piva('fornitore', partialConfig.fornitore);
  if (partialConfig.fornitore?.codiceFiscale !== undefined) {
    const cf = partialConfig.fornitore.codiceFiscale;
    if (!campoValido(cf, REGEX_CF_PERSONA_FISICA) && !campoValido(cf, REGEX_PIVA)) {
      errori.push('fornitore: Codice Fiscale non valido (16 caratteri, o Partita IVA per società)');
    }
  }
  if (Array.isArray(partialConfig.clienti)) {
    const idVisti = new Set();
    partialConfig.clienti.forEach((c, i) => {
      const etichetta = c.denominazione || `#${i + 1}`;
      piva(`cliente[${etichetta}]`, c);
      if (c.codiceDestinatarioSdi !== undefined
        && !campoValido(c.codiceDestinatarioSdi, REGEX_CODICE_SDI)) {
        errori.push(`cliente[${etichetta}]: Codice destinatario SDI deve essere di 7 caratteri alfanumerici`);
      }
      if (!c.id || idVisti.has(c.id)) {
        errori.push(`cliente[${etichetta}]: ogni cliente deve avere un id univoco`);
      }
      idVisti.add(c.id);
      if (c.email !== undefined && String(c.email).trim()) {
        const nonValide = String(c.email).split(',').map(e => e.trim()).filter(e => e && !REGEX_EMAIL.test(e));
        if (nonValide.length) {
          errori.push(`cliente[${etichetta}]: email non valida: ${nonValide.join(', ')}`);
        }
      }
    });
  }
  if (partialConfig.pec?.casellaMittente !== undefined
    && !campoValido(partialConfig.pec.casellaMittente, REGEX_EMAIL)) {
    errori.push('pec: Casella PEC mittente non è un indirizzo email valido');
  }
  return errori;
}

// Interpreta il valore password arrivato dal frontend: placeholder o undefined → non toccare
// (utente non ha modificato il campo), stringa vuota → utente ha cancellato la password,
// altro valore → nuova password da salvare nel Keychain.
async function applicaPassword(account, valoreInArrivo, valoreAttuale) {
  if (valoreInArrivo === undefined || valoreInArrivo === PASSWORD_PLACEHOLDER) {
    return valoreAttuale;
  }
  if (valoreInArrivo === '') {
    await keytar.deletePassword(KEYTAR_SERVICE, account);
    return '';
  }
  await keytar.setPassword(KEYTAR_SERVICE, account, valoreInArrivo);
  return valoreInArrivo;
}

export async function saveConfig(partialConfig) {
  const current = await getConfig();
  // clienti[] arriva intero dal frontend (che tiene l'intero elenco in memoria prima di
  // salvare) — non serve merge shallow per-campo come le altre sezioni oggetto; basta
  // garantire che ogni cliente abbia un id anche se il chiamante ne ha aggiunto uno senza.
  const clienti = (partialConfig.clienti ?? current.clienti)
    .map((c) => ({ ...c, id: c.id || randomUUID() }));

  const passwordMittente = await applicaPassword(
    KEYTAR_ACCOUNT_PEC, partialConfig.pec?.passwordMittente, current.pec.passwordMittente,
  );
  const backupPassword = await applicaPassword(
    KEYTAR_ACCOUNT_BACKUP, partialConfig.backup?.password, current.backup.password,
  );

  const next = {
    ...current,
    ...partialConfig,
    fornitore: fondiSezione(current.fornitore, partialConfig.fornitore),
    clienti,
    fatturazione: fondiSezione(current.fatturazione, partialConfig.fatturazione),
    pec: { ...fondiSezione(current.pec, partialConfig.pec), passwordMittente: '' },
    sdi: fondiSezione(current.sdi, partialConfig.sdi),
    backup: { ...fondiSezione(current.backup, partialConfig.backup), password: '' },
    reminder: fondiSezione(current.reminder, partialConfig.reminder),
    forfettario: fondiSezione(current.forfettario, partialConfig.forfettario),
    // dati.percorso non passa mai da qui: cambiarlo senza spostare i file lascerebbe
    // config.json a mentire sul percorso reale. Va solo tramite spostaPercorsoDati().
    dati: current.dati,
  };
  // Su disco (config.json) le due password restano sempre vuote: risiedono solo nel Keychain.
  await writeJson(CONFIG_FILE, next);
  return { ...next, pec: { ...next.pec, passwordMittente }, backup: { ...next.backup, password: backupPassword } };
}

// Da chiamare una sola volta all'avvio del server: applica l'override di backend/data/
// letto da config.json (nella cartella di default) prima di qualunque altra I/O.
export async function applicaPercorsoDatiAllAvvio() {
  const config = await readJson(CONFIG_FILE, null);
  if (config?.dati?.percorso) setDataDir(config.dati.percorso);
}

// Cambia backend/data/ spostando fisicamente ogni file esistente nella nuova cartella
// (mai perdita dati: se la nuova cartella esiste già e non è vuota, si rifiuta). Usata da
// Impostazioni → Percorso dati, non tramite saveConfig (vedi commento su dati.percorso sopra).
export async function spostaPercorsoDati(nuovoPercorso) {
  const percorsoAssoluto = path.resolve(nuovoPercorso || '');
  if (!percorsoAssoluto) throw new Error('Percorso mancante');
  if (percorsoAssoluto === DATA_DIR) throw new Error('Il percorso indicato è già quello attuale');

  await mkdir(percorsoAssoluto, { recursive: true });
  const vociEsistenti = await readdir(percorsoAssoluto);
  if (vociEsistenti.length > 0) {
    throw new Error('La cartella scelta non è vuota: spostare/svuotare manualmente prima di riprovare');
  }

  const vecchioDir = DATA_DIR;
  const voci = await readdir(vecchioDir).catch((err) => {
    if (err.code === 'ENOENT') return [];
    throw err;
  });
  // rename() è atomico per voce quando sorgente/destinazione sono sullo stesso filesystem;
  // su filesystem diversi Node lo emula con copia+cancellazione automaticamente.
  for (const voce of voci) {
    await rename(path.join(vecchioDir, voce), path.join(percorsoAssoluto, voce));
  }

  setDataDir(percorsoAssoluto);
  const config = await readJson(CONFIG_FILE, null);
  await writeJson(CONFIG_FILE, { ...config, dati: { ...(config?.dati ?? {}), percorso: percorsoAssoluto } });

  // Cartella vecchia: a questo punto è vuota (tutto spostato con rename sopra).
  // recursive:true serve comunque a fs.rm per rimuovere una directory anche vuota.
  await rm(vecchioDir, { recursive: true }).catch(() => {});

  return percorsoAssoluto;
}
