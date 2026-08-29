<script setup>
// Import di storico pregresso: timesheet da xls originale (stesso layout del template),
// fatture da XML FatturaPA già emesse. Azione one-off, indipendente dalla configurazione.
import { ref } from 'vue';
import { api } from '../services/api.js';

const oggi = new Date();
const annoTimesheet = ref(oggi.getFullYear());
const meseTimesheet = ref(oggi.getMonth() + 1);
const fileTimesheet = ref(null);
const importandoTimesheet = ref(false);
const esitoTimesheet = ref('');

const fileFattura = ref(null);
const importandoFattura = ref(false);
const esitoFattura = ref('');

async function importaTimesheet() {
  if (!fileTimesheet.value) return;
  importandoTimesheet.value = true;
  esitoTimesheet.value = '';
  try {
    await api.importaTimesheet(annoTimesheet.value, meseTimesheet.value, fileTimesheet.value);
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
    const invoice = await api.importaFattura(fileFattura.value);
    const notaArchivio = invoice.archiviato ? ' · XML copiato in archivio' : ' · XML già presente in archivio, non toccato';
    esitoFattura.value = `Importata: fattura n.${invoice.numero} del ${invoice.mese}/${invoice.anno}${notaArchivio}`;
  } catch (err) {
    esitoFattura.value = `Errore: ${err.message}`;
  } finally {
    importandoFattura.value = false;
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

    <div class="card" style="margin-top:16px">
      <div class="card-head"><h2>Importa Timesheet da Excel</h2></div>
      <div class="card-body" style="display:flex;flex-direction:column;gap:10px">
        <p class="note-legal">File xls con lo stesso layout del foglio originale (MRO Pianificazione Mensile).</p>
        <div class="form-grid">
          <div class="field"><label>Anno</label><input type="number" v-model.number="annoTimesheet"></div>
          <div class="field"><label>Mese</label><input type="number" min="1" max="12" v-model.number="meseTimesheet"></div>
          <div class="field field-full full"><label>File .xls</label><input type="file" accept=".xls,.xlsx" @change="e => fileTimesheet = e.target.files[0]"></div>
        </div>
        <button class="btn btn-primary" :disabled="!fileTimesheet || importandoTimesheet" @click="importaTimesheet">
          {{ importandoTimesheet ? 'Importo…' : 'Importa timesheet' }}
        </button>
        <span v-if="esitoTimesheet" class="badge-mono">{{ esitoTimesheet }}</span>
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <div class="card-head"><h2>Importa Fattura da XML FatturaPA</h2></div>
      <div class="card-body" style="display:flex;flex-direction:column;gap:10px">
        <p class="note-legal">Anno, mese e numero vengono letti direttamente dal file XML.</p>
        <div class="form-grid">
          <div class="field field-full full"><label>File .xml</label><input type="file" accept=".xml" @change="e => fileFattura = e.target.files[0]"></div>
        </div>
        <button class="btn btn-primary" :disabled="!fileFattura || importandoFattura" @click="importaFattura">
          {{ importandoFattura ? 'Importo…' : 'Importa fattura' }}
        </button>
        <span v-if="esitoFattura" class="badge-mono">{{ esitoFattura }}</span>
      </div>
    </div>
  </div>
</template>
