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
  };
  await writeJson(CONFIG_FILE, next);
  return next;
}
