<script setup>
// Data di incasso fatture da CSV home banking: solo i nomi colonna del file vengono
// inviati a Gemini per riconoscere automaticamente la struttura (mai righe/importi/causali
// reali), vedi AI-Workspace/Plans/DATE_PAGAMENTO_FATTURE.md.
import { ref } from 'vue';
import { api } from '../services/api.js';
import FileDrop from '../components/common/FileDrop.vue';

const analizzando = ref(false);
const errore = ref('');
const proposte = ref([]);
const confermati = ref(new Set());

async function analizzaFile(files) {
  const file = files[0];
  if (!file) return;
  errore.value = '';
  proposte.value = [];
  analizzando.value = true;
  try {
    const { proposte: trovate } = await api.analizzaCsvPagamenti(file);
    proposte.value = trovate;
  } catch (err) {
    errore.value = err.message;
  } finally {
    analizzando.value = false;
  }
}

async function conferma(proposta, indice) {
  const { anno, mese, clienteId } = proposta.fattura;
  try {
    await api.confermaPagamentoFattura(anno, mese, clienteId, proposta.data);
    confermati.value.add(indice);
  } catch (err) {
    errore.value = err.message;
  }
}

function formattaEuro(valore) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(valore ?? 0);
}
</script>

<template>
  <div>
    <div class="page-head">
      <div><h1>Pagamenti fatture</h1><p>Riconosce la data di incasso dai movimenti dell'home banking</p></div>
    </div>

    <p v-if="errore" class="note-legal">Errore: {{ errore }}</p>

    <div class="card">
      <div class="card-head"><h2>Carica movimenti (CSV home banking)</h2></div>
      <div class="card-body">
        <p class="note-legal">
          Del file caricato vengono inviati a Google Gemini <strong>solo i nomi delle colonne</strong>
          (es. "Data operazione", "Importo") per riconoscere automaticamente la struttura — mai righe,
          importi o causali reali. Il mapping viene salvato: lo stesso formato file non richiede una
          seconda chiamata a Gemini.
        </p>
        <FileDrop accept=".csv" label="Trascina il CSV o clicca per sfogliare" style="margin-top:10px" :disabled="analizzando" @change="analizzaFile" />
        <p v-if="analizzando" class="note-legal">Analisi in corso…</p>

        <table v-if="proposte.length" class="data-table" style="margin-top:16px">
          <thead><tr><th>Data</th><th>Importo</th><th>Descrizione</th><th>Fattura</th><th></th></tr></thead>
          <tbody>
            <tr v-for="(p, i) in proposte" :key="i">
              <td>{{ p.data }}</td>
              <td>{{ formattaEuro(p.importo) }}</td>
              <td>{{ p.descrizione }}</td>
              <td>
                <span v-if="confermati.has(i)">✓ Registrato</span>
                <span v-else-if="p.fattura">N. {{ p.fattura.numero }} ({{ p.fattura.anno }}-{{ String(p.fattura.mese).padStart(2, '0') }})</span>
                <span v-else-if="p.ambiguo" class="note-legal">Più fatture con lo stesso importo</span>
                <span v-else class="note-legal">Nessuna fattura corrispondente</span>
              </td>
              <td>
                <button v-if="p.fattura && !confermati.has(i)" type="button" class="btn btn-ok" @click="conferma(p, i)">Conferma</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
