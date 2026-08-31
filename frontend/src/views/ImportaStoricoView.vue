<script setup>
// Import di storico pregresso: timesheet da xls originale (stesso layout del template),
// fatture da XML FatturaPA già emesse. Azione one-off, indipendente dalla configurazione.
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../services/api.js';
import { PASSI_IMPORTA_STORICO as PASSI } from '../wizardImportaStoricoPassi.js';

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
const importandoTimesheet = ref(false);
const esitoTimesheet = ref('');

const clienti = ref([]);
const clienteIdTimesheet = ref(null);
const clienteIdFattura = ref(''); // opzionale: solo se il match automatico per p.iva fallisce

const fileFattura = ref(null);
const importandoFattura = ref(false);
const esitoFattura = ref('');

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

async function importaTimesheet() {
  if (!fileTimesheet.value || !clienteIdTimesheet.value) return;
  importandoTimesheet.value = true;
  esitoTimesheet.value = '';
  try {
    await api.importaTimesheet(annoTimesheet.value, meseTimesheet.value, clienteIdTimesheet.value, fileTimesheet.value);
    esitoTimesheet.value = `Importato: timesheet ${meseTimesheet.value}/${annoTimesheet.value}`;
  } catch (err) {
    esitoTimesheet.value = `Errore: ${err.message}`;
  } finally {
    importandoTimesheet.value = false;
  }
}

async function importaFattura() {
  if (!fileFattura.value) return;
  importandoFattura.value = true;
  esitoFattura.value = '';
  try {
    const invoice = await api.importaFattura(fileFattura.value, clienteIdFattura.value || undefined);
    const notaArchivio = invoice.archiviato ? ' · XML copiato in archivio' : ' · XML già presente in archivio, non toccato';
    esitoFattura.value = `Importata: fattura n.${invoice.numero} del ${invoice.mese}/${invoice.anno}${notaArchivio}`;
  } catch (err) {
    esitoFattura.value = `Errore: ${err.message}`;
  } finally {
    importandoFattura.value = false;
  }
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
    passwordRipristina.value = '';
  } catch (err) {
    esitoRipristinaBackup.value = `Errore: ${err.message}`;
  } finally {
    ripristinandoBackup.value = false;
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
          <div class="field field-full full"><label>File .xls</label><input type="file" accept=".xls,.xlsx" @change="e => fileTimesheet = e.target.files[0]"></div>
        </div>
        <button class="btn btn-primary" :disabled="!fileTimesheet || !clienteIdTimesheet || importandoTimesheet" @click="importaTimesheet">
          {{ importandoTimesheet ? 'Importo…' : 'Importa timesheet' }}
        </button>
        <span v-if="esitoTimesheet" class="badge-mono">{{ esitoTimesheet }}</span>
      </div>
    </div>

    <div class="card" style="margin-top:16px" v-if="passoAttivo === 1">
      <div class="card-head"><h2>Importa Fattura da XML FatturaPA</h2></div>
      <div class="card-body" style="display:flex;flex-direction:column;gap:10px">
        <p class="note-legal">Anno, mese e numero vengono letti direttamente dal file XML. Il cliente viene riconosciuto dalla partita IVA nell'XML; specificalo qui solo se l'import segnala di non riuscire a determinarlo automaticamente.</p>
        <div class="form-grid">
          <div class="field field-full full"><label>File .xml</label><input type="file" accept=".xml" @change="e => fileFattura = e.target.files[0]"></div>
          <div class="field field-full full" v-if="clienti.length > 1">
            <label>Cliente (solo se richiesto)</label>
            <select v-model="clienteIdFattura">
              <option value="">Riconosci automaticamente</option>
              <option v-for="c in clienti" :key="c.id" :value="c.id">{{ c.denominazione || 'Cliente senza nome' }}</option>
            </select>
          </div>
        </div>
        <button class="btn btn-primary" :disabled="!fileFattura || importandoFattura" @click="importaFattura">
          {{ importandoFattura ? 'Importo…' : 'Importa fattura' }}
        </button>
        <span v-if="esitoFattura" class="badge-mono">{{ esitoFattura }}</span>
      </div>
    </div>

    <div class="card" style="margin-top:16px" v-if="passoAttivo === 2">
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

    <div class="card" style="margin-top:16px" v-if="passoAttivo === 3">
      <div class="card-head"><h2>Ripristina da backup</h2></div>
      <div class="card-body" style="display:flex;flex-direction:column;gap:10px">
        <p class="note-legal">Sovrascrive i dati esistenti su questa macchina con quelli del backup.</p>
        <div class="form-grid">
          <div class="field field-full full"><label>File backup</label><input type="file" accept=".tsbk" @change="e => fileBackup = e.target.files[0]"></div>
          <div class="field field-full full"><label>Password</label><input type="password" v-model="passwordRipristina"></div>
        </div>
        <button class="btn btn-primary" :disabled="!fileBackup || !passwordRipristina || ripristinandoBackup" @click="ripristinaBackup">
          {{ ripristinandoBackup ? 'Ripristino…' : 'Ripristina backup' }}
        </button>
        <span v-if="esitoRipristinaBackup" class="badge-mono">{{ esitoRipristinaBackup }}</span>
      </div>
    </div>
  </div>
</template>
