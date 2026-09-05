<script setup>
// Versamenti F24 effettivi (imposta sostitutiva, INPS) inseriti a mano, confrontati con
// l'imposta stimata dal regime forfettario (vedi AI-Workspace/Plans/F24_STEP1_RICOGNIZIONE.md).
import { ref, computed, onMounted, watch } from 'vue';
import { api } from '../services/api.js';

const anni = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);
const annoSelezionato = ref(new Date().getFullYear());
const impostaStimata = ref(0);
const versamenti = ref([]);
const errore = ref('');

const ricerca = ref('');
const filtroTipo = ref('');
const tipiVersamento = ['Imposta sostitutiva', 'INPS', 'Altro'];

const nuovoVersamento = ref({ data: '', tipo: tipiVersamento[0], importo: null });

const testoIncollato = ref('');
const anteprimaImport = ref(null);
const importando = ref(false);

async function anteprimaImportaTesto() {
  errore.value = '';
  anteprimaImport.value = null;
  try {
    const { versamenti: trovati } = await api.anteprimaImportVersamentiF24(testoIncollato.value);
    anteprimaImport.value = trovati;
  } catch (err) {
    errore.value = err.message;
  }
}

async function confermaImportaTesto() {
  importando.value = true;
  errore.value = '';
  try {
    const { importati, aggiornati } = await api.importaVersamentiF24(testoIncollato.value);
    anteprimaImport.value = null;
    testoIncollato.value = '';
    errore.value = aggiornati ? `Importati ${importati.length} (${aggiornati} già presenti, aggiornati).` : '';
    await carica();
  } catch (err) {
    errore.value = err.message;
  } finally {
    importando.value = false;
  }
}

async function carica() {
  errore.value = '';
  try {
    const [dashboard, elenco] = await Promise.all([
      api.dashboardForfettario(annoSelezionato.value),
      api.versamentiF24(annoSelezionato.value),
    ]);
    impostaStimata.value = dashboard.impostaStimata;
    versamenti.value = elenco;
  } catch (err) {
    errore.value = err.message;
  }
}

async function salvaVersamento() {
  try {
    await api.aggiungiVersamentoF24(nuovoVersamento.value);
    nuovoVersamento.value = { data: '', tipo: tipiVersamento[0], importo: null };
    await carica();
  } catch (err) {
    errore.value = err.message;
  }
}

async function rimuoviVersamento(id) {
  await api.eliminaVersamentoF24(id);
  await carica();
}

onMounted(carica);
watch(annoSelezionato, carica);

const versamentiFiltrati = computed(() => versamenti.value.filter((v) => {
  if (filtroTipo.value && v.tipo !== filtroTipo.value) return false;
  if (ricerca.value && !v.tipo.toLowerCase().includes(ricerca.value.toLowerCase())) return false;
  return true;
}));

const totaleVersato = computed(() => versamenti.value.reduce((tot, v) => tot + v.importo, 0));

function esportaCsv() {
  window.open(api.urlExportVersamentiF24(annoSelezionato.value), '_blank');
}

function formattaEuro(valore) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(valore ?? 0);
}
</script>

<template>
  <div>
    <div class="page-head">
      <div><h1>Versamenti F24</h1><p>Registrazione manuale dei versamenti effettivi, confronto con l'imposta stimata</p></div>
      <select v-model.number="annoSelezionato" class="status">
        <option v-for="a in anni" :key="a" :value="a">{{ a }}</option>
      </select>
    </div>

    <p v-if="errore" class="note-legal">Errore: {{ errore }}</p>

    <div class="summary-row">
      <div class="stat"><div class="label">Imposta stimata</div><div class="value">{{ formattaEuro(impostaStimata) }}</div></div>
      <div class="stat" :class="totaleVersato >= impostaStimata ? 'ok' : 'warn'">
        <div class="label">Versato</div><div class="value">{{ formattaEuro(totaleVersato) }}</div>
      </div>
      <div class="stat"><div class="label">Residuo da versare</div><div class="value">{{ formattaEuro(Math.max(impostaStimata - totaleVersato, 0)) }}</div></div>
    </div>

    <div class="card" style="margin-top:20px">
      <div class="card-head">
        <h2>Elenco versamenti {{ annoSelezionato }}</h2>
        <button type="button" class="btn btn-ghost" @click="esportaCsv">Esporta CSV</button>
      </div>
      <div class="card-body">
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <div class="field"><label>Cerca per tipo</label><input type="text" v-model="ricerca" placeholder="es. INPS"></div>
          <div class="field">
            <label>Filtra tipo</label>
            <select v-model="filtroTipo">
              <option value="">Tutti</option>
              <option v-for="t in tipiVersamento" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
        </div>

        <table class="data-table" style="margin-top:16px">
          <thead><tr><th>Data</th><th>Tipo</th><th>Importo</th><th></th></tr></thead>
          <tbody>
            <tr v-for="v in versamentiFiltrati" :key="v.id">
              <td>{{ v.data }}</td>
              <td>{{ v.tipo }}</td>
              <td>{{ formattaEuro(v.importo) }}</td>
              <td><button class="btn-icon" @click="rimuoviVersamento(v.id)" title="Elimina" aria-label="Elimina versamento">✕</button></td>
            </tr>
            <tr v-if="!versamentiFiltrati.length"><td colspan="4" class="note-legal">Nessun versamento.</td></tr>
          </tbody>
        </table>

        <form @submit.prevent="salvaVersamento" style="display:flex;gap:12px;margin-top:20px;align-items:flex-end;flex-wrap:wrap">
          <div class="field"><label>Data</label><input type="date" v-model="nuovoVersamento.data" required></div>
          <div class="field">
            <label>Tipo</label>
            <select v-model="nuovoVersamento.tipo">
              <option v-for="t in tipiVersamento" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
          <div class="field"><label>Importo (€)</label><input type="number" step="0.01" min="0.01" v-model.number="nuovoVersamento.importo" required></div>
          <button type="submit" class="btn btn-ok">Aggiungi</button>
        </form>
      </div>
    </div>

    <div class="card" style="margin-top:20px">
      <div class="card-head"><h2>Importa da Cassetto Fiscale</h2></div>
      <div class="card-body">
        <p class="note-legal">
          Nel <a href="https://cassetto.agenziaentrate.gov.it" target="_blank" rel="noopener">Cassetto Fiscale</a>,
          apri Versamenti → Modello F24, seleziona tutta la pagina (cmd+A), copia (cmd+C) e incolla qui sotto (cmd+V).
          Vengono riconosciuti data e importo di ogni versamento (il tributo specifico non è riportato in questa vista,
          va corretto a mano il tipo se serve distinguerlo).
        </p>
        <textarea
          v-model="testoIncollato"
          rows="8"
          placeholder="Incolla qui il testo copiato dalla pagina Versamenti del Cassetto Fiscale…"
          style="width:100%;margin-top:10px;border:1px solid var(--line);border-radius:8px;padding:10px;background:var(--ground);color:var(--ink);font-family:inherit;font-size:.86rem;resize:vertical"
        ></textarea>
        <div style="display:flex;gap:10px;margin-top:10px">
          <button type="button" class="btn btn-ghost" :disabled="!testoIncollato" @click="anteprimaImportaTesto">Analizza</button>
          <button v-if="anteprimaImport?.length" type="button" class="btn btn-ok" :disabled="importando" @click="confermaImportaTesto">
            Importa {{ anteprimaImport.length }} versamenti
          </button>
        </div>

        <table v-if="anteprimaImport?.length" class="data-table" style="margin-top:16px">
          <thead><tr><th>Data</th><th>Tipo</th><th>Importo</th></tr></thead>
          <tbody>
            <tr v-for="(v, i) in anteprimaImport" :key="i">
              <td>{{ v.data }}</td>
              <td>{{ v.tipo }}</td>
              <td>{{ formattaEuro(v.importo) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.btn-icon {
  border: 1px solid var(--line); background: var(--card); color: var(--ink);
  border-radius: 6px; width: 24px; height: 24px; line-height: 1; cursor: pointer;
  font-size: .95rem;
}
</style>
