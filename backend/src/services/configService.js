// Gestione configurazione: anagrafica fornitore, cliente, tariffa oraria, dati PEC/SDI.
// Un unico file config.json salvato nella root dei dati.
import { readJson, writeJson } from '../lib/jsonStore.js';

const CONFIG_FILE = 'config.json';

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
  cliente: {
    denominazione: '',
    indirizzo: '',
    cap: '',
    comune: '',
    provincia: '',
    partitaIva: '',
    codiceDestinatarioSdi: '',
    logoDataUrl: '', // logo mostrato nella stampa PDF del Timesheet (es. logo commessa/cliente)
  },
  fatturazione: {
    tariffaOraria: 0,
    progressivoInvio: 1,
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
};

// Fonde una sezione salvata con i suoi default: se in futuro aggiungiamo un nuovo campo
// a una sezione (es. sdi.pollingAbilitato), i config.json già salvati su disco lo ricevono
// comunque invece di perderlo per via di uno spread shallow che sovrascrive l'intera sezione.
function fondiSezione(default_, salvata) {
  return { ...default_, ...(salvata ?? {}) };
}

export async function getConfig() {
  const config = await readJson(CONFIG_FILE, null);
  if (!config) return DEFAULT_CONFIG;
  return {
    ...DEFAULT_CONFIG,
    ...config,
    fornitore: fondiSezione(DEFAULT_CONFIG.fornitore, config.fornitore),
    cliente: fondiSezione(DEFAULT_CONFIG.cliente, config.cliente),
    fatturazione: fondiSezione(DEFAULT_CONFIG.fatturazione, config.fatturazione),
    pec: fondiSezione(DEFAULT_CONFIG.pec, config.pec),
    sdi: fondiSezione(DEFAULT_CONFIG.sdi, config.sdi),
    backup: fondiSezione(DEFAULT_CONFIG.backup, config.backup),
    reminder: fondiSezione(DEFAULT_CONFIG.reminder, config.reminder),
    forfettario: fondiSezione(DEFAULT_CONFIG.forfettario, config.forfettario),
  };
}

export async function saveConfig(partialConfig) {
  const current = await getConfig();
  const next = {
    ...current,
    ...partialConfig,
    fornitore: fondiSezione(current.fornitore, partialConfig.fornitore),
    cliente: fondiSezione(current.cliente, partialConfig.cliente),
    fatturazione: fondiSezione(current.fatturazione, partialConfig.fatturazione),
    pec: fondiSezione(current.pec, partialConfig.pec),
    sdi: fondiSezione(current.sdi, partialConfig.sdi),
    backup: fondiSezione(current.backup, partialConfig.backup),
    reminder: fondiSezione(current.reminder, partialConfig.reminder),
    forfettario: fondiSezione(current.forfettario, partialConfig.forfettario),
  };
  await writeJson(CONFIG_FILE, next);
  return next;
}
