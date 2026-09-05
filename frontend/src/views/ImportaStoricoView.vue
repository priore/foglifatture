<script setup>
// Import di storico pregresso: timesheet da xls originale (stesso layout del template),
// fatture da XML FatturaPA già emesse. Azione one-off, indipendente dalla configurazione.
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../services/api.js';
import { PASSI_IMPORTA_STORICO as PASSI } from '../wizardImportaStoricoPassi.js';
import FileDrop from '../components/common/FileDrop.vue';

const route = useRoute();
const router = useRouter();
// La sezione attiva vive nella query string (?passo=N), come in Impostazioni,
// così le sotto-voci verticali in AppSidebar possono linkarci direttamente con router-link.
const passoAttivo = computed({
  get: () => {
    const n = Number(route.query.passo);
    return Number.isInteger(n) && n >= 0 && n < PASSI.length ? n : 0;
  },
  set: (n) => router.push({ query: { passo: n } }),
});

const oggi = new Date();
const annoTimesheet = ref(oggi.getFullYear());
const meseTimesheet = ref(oggi.getMonth() + 1);
const fileTimesheet = ref(null);
const fileTimesheetMulti = ref([]);
const importandoTimesheet = ref(false);
const esitoTimesheet = ref('');

const clienti = ref([]);
const clienteIdTimesheet = ref(null);
const clienteIdFattura = ref(''); // opzionale: solo se il match automatico per p.iva fallisce

const fileFattura = ref(null);
const fileFatturaMulti = ref([]);
const importandoFattura = ref(false);
const esitoFattura = ref('');

// Esito di un import batch: un risultato ok/errore per file, mostrato come lista invece
// del messaggio singolo usato per l'import di un file solo.
function formattaEsitoBatch(risultati) {
  return risultati
    .map(r => r.ok ? `✓ ${r.file}` : `✗ ${r.file}: ${r.errore}`)
    .join('\n');
}

onMounted(async () => {
  const config = await api.getConfig();
  clienti.value = config.clienti.filter(c => c.attivo);
  clienteIdTimesheet.value = clienti.value[0]?.id ?? null;
});

const passwordEsporta = ref('');
const esportandoBackup = ref(false);
const esitoEsportaBackup = ref('');

const fileBackup = ref(null);
const passwordRipristina = ref('');
const ripristinandoBackup = ref(false);
const esitoRipristinaBackup = ref('');
const serveRiavvio = ref(false);
const riavviando = ref(false);

async function importaTimesheet() {
  if (!clienteIdTimesheet.value) return;
  importandoTimesheet.value = true;
  esitoTimesheet.value = '';
  try {
    if (fileTimesheetMulti.value.length) {
      const { risultati } = await api.importaTimesheetBatch(clienteIdTimesheet.value, fileTimesheetMulti.value);
      esitoTimesheet.value = formattaEsitoBatch(risultati);
    } else if (fileTimesheet.value) {
      await api.importaTimesheet(annoTimesheet.value, meseTimesheet.value, clienteIdTimesheet.value, fileTimesheet.value);
      esitoTimesheet.value = `Importato: timesheet ${meseTimesheet.value}/${annoTimesheet.value}`;
    }
  } catch (err) {
    esitoTimesheet.value = `Errore: ${err.message}`;
  } finally {
    importandoTimesheet.value = false;
  }
}

async function importaFattura() {
  if (!fileFattura.value && !fileFatturaMulti.value.length) return;
  importandoFattura.value = true;
  esitoFattura.value = '';
  try {
    if (fileFatturaMulti.value.length) {
      const { risultati } = await api.importaFatturaBatch(fileFatturaMulti.value, clienteIdFattura.value || undefined);
      esitoFattura.value = formattaEsitoBatch(risultati);
    } else {
      const invoice = await api.importaFattura(fileFattura.value, clienteIdFattura.value || undefined);
      const notaArchivio = invoice.archiviato ? ' · XML copiato in archivio' : ' · XML già presente in archivio, non toccato';
      esitoFattura.value = `Importata: fattura n.${invoice.numero} del ${invoice.mese}/${invoice.anno}${notaArchivio}`;
    }
  } catch (err) {
    esitoFattura.value = `Errore: ${err.message}`;
  } finally {
    importandoFattura.value = false;
  }
}

const analizzandoPagamenti = ref(false);
const erroreProposte = ref('');
const propostePagamenti = ref([]);
const confermatiPagamenti = ref(new Set());

async function analizzaFilePagamenti(files) {
  const file = files[0];
  if (!file) return;
  erroreProposte.value = '';
  propostePagamenti.value = [];
  confermatiPagamenti.value = new Set();
  analizzandoPagamenti.value = true;
  try {
    const { proposte: trovate } = await api.analizzaCsvPagamenti(file);
    propostePagamenti.value = trovate;
  } catch (err) {
    erroreProposte.value = err.message;
  } finally {
    analizzandoPagamenti.value = false;
  }
}

async function confermaPagamento(proposta, indice) {
  const { anno, mese, clienteId } = proposta.fattura;
  try {
    await api.confermaPagamentoFattura(anno, mese, clienteId, proposta.data);
    confermatiPagamenti.value.add(indice);
  } catch (err) {
    erroreProposte.value = err.message;
  }
}

function formattaEuro(valore) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(valore ?? 0);
}

async function esportaBackup() {
  if (!passwordEsporta.value) return;
  esportandoBackup.value = true;
  esitoEsportaBackup.value = '';
  try {
    const { blob, nomeFile } = await api.esportaBackup(passwordEsporta.value);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeFile;
    link.click();
    URL.revokeObjectURL(url);
    esitoEsportaBackup.value = 'Backup scaricato';
    passwordEsporta.value = '';
  } catch (err) {
    esitoEsportaBackup.value = `Errore: ${err.message}`;
  } finally {
    esportandoBackup.value = false;
  }
}

async function ripristinaBackup() {
  if (!fileBackup.value || !passwordRipristina.value) return;
  ripristinandoBackup.value = true;
  esitoRipristinaBackup.value = '';
  try {
    const risultato = await api.ripristinaBackup(fileBackup.value, passwordRipristina.value);
    esitoRipristinaBackup.value = `Ripristinati ${risultato.fileRipristinati} file. Riavvia l'app per applicare i dati.`;
    serveRiavvio.value = true;
    passwordRipristina.value = '';
  } catch (err) {
    esitoRipristinaBackup.value = `Errore: ${err.message}`;
  } finally {
    ripristinandoBackup.value = false;
  }
}

async function riavvia() {
  riavviando.value = true;
  try {
    await api.riavviaApp();
    esitoRipristinaBackup.value = 'Riavvio in corso…';
    serveRiavvio.value = false;
  } catch (err) {
    esitoRipristinaBackup.value = `Errore: ${err.message}`;
  } finally {
    riavviando.value = false;
  }
}
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1>Importa storico</h1>
        <p>Recupera mesi passati non ancora presenti nell'app</p>
      </div>
    </div>

    <p class="note-legal">
      La griglia timesheet e la fattura importate diventano subito visibili/modificabili
      nelle rispettive schermate.
    </p>

    <div class="card" style="margin-top:16px" v-if="passoAttivo === 0">
      <div class="card-head"><h2>Importa Timesheet da Excel</h2></div>
      <div class="card-body" style="display:flex;flex-direction:column;gap:10px">
        <p class="note-legal">File xls con lo stesso layout del foglio originale (MRO Pianificazione Mensile).</p>
        <div class="form-grid">
          <div class="field"><label>Anno</label><input type="number" v-model.number="annoTimesheet"></div>
          <div class="field"><label>Mese</label><input type="number" min="1" max="12" v-model.number="meseTimesheet"></div>
          <div class="field" v-if="clienti.length > 1">
            <label>Cliente</label>
            <select v-model="clienteIdTimesheet">
              <option v-for="c in clienti" :key="c.id" :value="c.id">{{ c.denominazione || 'Cliente senza nome' }}</option>
            </select>
          </div>
          <div class="field field-full full">
            <label>File .xls (uno o più; anno/mese letti dal file)</label>
            <FileDrop
              accept=".xls,.xlsx"
              multiple
              label="Trascina i file .xls o clicca per sfogliare"
              @change="files => { fileTimesheetMulti = files; fileTimesheet = files.length === 1 ? files[0] : null; }"
            />
            <span v-if="fileTimesheetMulti.length" class="badge-mono">{{ fileTimesheetMulti.length }} file selezionati</span>
          </div>
          <div class="field field-full full">
            <label>Oppure intera cartella</label>
            <FileDrop
              directory
              label="Trascina una cartella o clicca per sceglierla"
              @change="files => { fileTimesheetMulti = files.filter(f => /\.xlsx?$/i.test(f.name)); fileTimesheet = null; }"
            />
          </div>
        </div>
        <button class="btn btn-primary" :disabled="(!fileTimesheet && !fileTimesheetMulti.length) || !clienteIdTimesheet || importandoTimesheet" @click="importaTimesheet">
          {{ importandoTimesheet ? 'Importo…' : 'Importa timesheet' }}
        </button>
        <pre v-if="esitoTimesheet" class="badge-mono" style="white-space:pre-wrap">{{ esitoTimesheet }}</pre>
      </div>
    </div>

    <div class="card" style="margin-top:16px" v-if="passoAttivo === 1">
      <div class="card-head"><h2>Importa Fattura da XML FatturaPA</h2></div>
      <div class="card-body" style="display:flex;flex-direction:column;gap:10px">
        <p class="note-legal">Anno, mese e numero vengono letti direttamente dal file XML. Il cliente viene riconosciuto dalla partita IVA nell'XML; specificalo qui solo se l'import segnala di non riuscire a determinarlo automaticamente.</p>
        <div class="form-grid">
          <div class="field field-full full">
            <label>File .xml (uno o più)</label>
            <FileDrop
              accept=".xml"
              multiple
              label="Trascina i file .xml o clicca per sfogliare"
              @change="files => { fileFatturaMulti = files; fileFattura = files.length === 1 ? files[0] : null; }"
            />
            <span v-if="fileFatturaMulti.length" class="badge-mono">{{ fileFatturaMulti.length }} file selezionati</span>
          </div>
          <div class="field field-full full">
            <label>Oppure intera cartella</label>
            <FileDrop
              directory
              label="Trascina una cartella o clicca per sceglierla"
              @change="files => { fileFatturaMulti = files.filter(f => /\.xml$/i.test(f.name)); fileFattura = null; }"
            />
          </div>
          <div class="field field-full full" v-if="clienti.length > 1">
            <label>Cliente (solo se richiesto)</label>
            <select v-model="clienteIdFattura">
              <option value="">Riconosci automaticamente</option>
              <option v-for="c in clienti" :key="c.id" :value="c.id">{{ c.denominazione || 'Cliente senza nome' }}</option>
            </select>
          </div>
        </div>
        <button class="btn btn-primary" :disabled="(!fileFattura && !fileFatturaMulti.length) || importandoFattura" @click="importaFattura">
          {{ importandoFattura ? 'Importo…' : 'Importa fattura' }}
        </button>
        <pre v-if="esitoFattura" class="badge-mono" style="white-space:pre-wrap">{{ esitoFattura }}</pre>
      </div>
    </div>

    <div class="card" style="margin-top:16px" v-if="passoAttivo === 2">
      <div class="card-head"><h2>Pagamenti fatture</h2></div>
      <div class="card-body">
        <p class="note-legal">Riconosce la data di incasso dai movimenti dell'home banking.</p>
        <p v-if="erroreProposte" class="note-legal">Errore: {{ erroreProposte }}</p>
        <p class="note-legal">
          Del file caricato vengono inviati a Google Gemini <strong>solo i nomi delle colonne</strong>
          (es. "Data operazione", "Importo") per riconoscere automaticamente la struttura — mai righe,
          importi o causali reali. Il mapping viene salvato: lo stesso formato file non richiede una
          seconda chiamata a Gemini.
        </p>
        <FileDrop accept=".csv" label="Trascina il CSV o clicca per sfogliare" style="margin-top:10px" :disabled="analizzandoPagamenti" @change="analizzaFilePagamenti" />
        <p v-if="analizzandoPagamenti" class="note-legal">Analisi in corso…</p>

        <table v-if="propostePagamenti.length" class="data-table" style="margin-top:16px">
          <thead><tr><th>Data</th><th>Importo</th><th>Descrizione</th><th>Fattura</th><th></th></tr></thead>
          <tbody>
            <tr v-for="(p, i) in propostePagamenti" :key="i">
              <td>{{ p.data }}</td>
              <td>{{ formattaEuro(p.importo) }}</td>
              <td>{{ p.descrizione }}</td>
              <td>
                <span v-if="confermatiPagamenti.has(i)">✓ Registrato</span>
                <span v-else-if="p.fattura">N. {{ p.fattura.numero }} ({{ p.fattura.anno }}-{{ String(p.fattura.mese).padStart(2, '0') }})</span>
                <span v-else-if="p.ambiguo" style="color:var(--muted)">Più fatture con lo stesso importo</span>
                <span v-else style="color:var(--muted)">Nessuna fattura corrispondente</span>
              </td>
              <td>
                <button v-if="p.fattura && !confermatiPagamenti.has(i)" type="button" class="btn btn-ok" @click="confermaPagamento(p, i)">Conferma</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card" style="margin-top:16px" v-if="passoAttivo === 3">
      <div class="card-head"><h2>Esporta backup dati</h2></div>
      <div class="card-body" style="display:flex;flex-direction:column;gap:10px">
        <p class="note-legal">Archivio cifrato di tutti i dati (timesheet, fatture, configurazione). Conserva la password: senza non è possibile ripristinare.</p>
        <div class="form-grid">
          <div class="field field-full full"><label>Password</label><input type="password" v-model="passwordEsporta"></div>
        </div>
        <button class="btn btn-primary" :disabled="!passwordEsporta || esportandoBackup" @click="esportaBackup">
          {{ esportandoBackup ? 'Esporto…' : 'Scarica backup' }}
        </button>
        <span v-if="esitoEsportaBackup" class="badge-mono">{{ esitoEsportaBackup }}</span>
      </div>
    </div>

    <div class="card" style="margin-top:16px" v-if="passoAttivo === 4">
      <div class="card-head"><h2>Ripristina da backup</h2></div>
      <div class="card-body" style="display:flex;flex-direction:column;gap:10px">
        <p class="note-legal">Sovrascrive i dati esistenti su questa macchina con quelli del backup.</p>
        <div class="form-grid">
          <div class="field field-full full">
            <label>File backup</label>
            <FileDrop accept=".tsbk" label="Trascina il file .tsbk o clicca per sfogliare" @change="files => fileBackup = files[0] ?? null" />
            <span v-if="fileBackup" class="badge-mono">{{ fileBackup.name }}</span>
          </div>
          <div class="field field-full full"><label>Password</label><input type="password" v-model="passwordRipristina"></div>
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          <button class="btn btn-primary" :disabled="!fileBackup || !passwordRipristina || ripristinandoBackup" @click="ripristinaBackup">
            {{ ripristinandoBackup ? 'Ripristino…' : 'Ripristina backup' }}
          </button>
          <button class="btn btn-warn" v-if="serveRiavvio" :disabled="riavviando" @click="riavvia">{{ riavviando ? 'Riavvio…' : 'Riavvia app' }}</button>
        </div>
        <span v-if="esitoRipristinaBackup" class="badge-mono">{{ esitoRipristinaBackup }}</span>
      </div>
    </div>
  </div>
</template>
