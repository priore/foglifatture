<script setup>
// Anagrafica fornitore e regime forfettario in un'unica pagina (2 pannelli): sono lo
// stesso soggetto fiscale, l'utente li compila/verifica insieme invece che in step separati.
import { ref, onMounted, computed } from 'vue';
import LogoUpload from './LogoUpload.vue';
import { pivaValida, codiceFiscaleValido } from '../../composables/useValidazioneFiscale.js';
import { api } from '../../services/api.js';

const props = defineProps({
  modelValue: { type: Object, required: true }, // config.fornitore
  forfettario: { type: Object, required: true }, // config.forfettario
  walletBtc: { type: Array, required: true }, // config.walletBtc: [{ etichetta, indirizzo }]
});
defineEmits(['salva-subito']);

// Indirizzo di default proposto negli incassi BTC (AI-Workspace/Plans/PAGAMENTI_BTC.md, F2):
// un solo indirizzo principale, gestito qui come primo elemento dell'array.
function aggiungiWalletBtc() {
  props.walletBtc.push({ etichetta: '', indirizzo: '' });
}
function rimuoviWalletBtc(indice) {
  props.walletBtc.splice(indice, 1);
}

const partitaIvaOk = computed(() => pivaValida(props.modelValue.partitaIva));
const codiceFiscaleOk = computed(() => codiceFiscaleValido(props.modelValue.codiceFiscale));

const codici = ref([]);
const ricerca = ref('');
const aggiornando = ref(false);
const messaggioAggiorna = ref('');

onMounted(async () => {
  codici.value = await api.settoriAteco();
  const attuale = codici.value.find((c) => c.codice === props.forfettario.codiceAteco);
  if (attuale) ricerca.value = `${attuale.codice} — ${attuale.descrizione}`;
});

async function aggiornaElencoAteco() {
  aggiornando.value = true;
  messaggioAggiorna.value = '';
  try {
    const risultato = await api.aggiornaSettoriAteco();
    codici.value = await api.settoriAteco();
    messaggioAggiorna.value = `Elenco aggiornato (${risultato.numero} codici)`;
  } catch (err) {
    messaggioAggiorna.value = `Errore: ${err.message}`;
  } finally {
    aggiornando.value = false;
  }
}

const risultati = computed(() => {
  const termine = ricerca.value.trim().toLowerCase();
  if (!termine) return [];
  return codici.value
    .filter((c) => c.codice.toLowerCase().includes(termine)
      || c.descrizione.toLowerCase().includes(termine)
      || c.settore.toLowerCase().includes(termine))
    .slice(0, 20);
});

function selezionaCodice(c) {
  props.forfettario.codiceAteco = c.codice;
  props.forfettario.settoreAteco = c.settore;
  props.forfettario.coefficenteRedditivita = c.coefficente;
  ricerca.value = `${c.codice} — ${c.descrizione}`;
}
</script>

<template>
  <div style="display:flex;flex-direction:column;gap:20px">
    <div class="card" style="margin-bottom:0">
      <div class="card-head"><h2>Fornitore</h2></div>
      <div class="card-body">
        <div class="form-grid">
          <div class="field full"><LogoUpload v-model="modelValue.logoDataUrl" etichetta="Logo per la Fattura Pro-Forma (PDF)" /></div>
          <div class="field"><label>Denominazione / Nome e cognome</label><input v-model="modelValue.denominazione"></div>
          <div class="field">
            <label>Partita IVA</label>
            <input v-model="modelValue.partitaIva" :class="{ 'campo-non-valido': !partitaIvaOk }" placeholder="11 cifre">
            <small v-if="!partitaIvaOk" class="nota-errore">Deve essere di 11 cifre numeriche.</small>
          </div>
          <div class="field">
            <label>Codice Fiscale</label>
            <input v-model="modelValue.codiceFiscale" :class="{ 'campo-non-valido': !codiceFiscaleOk }" placeholder="16 caratteri, o P.IVA se società">
            <small v-if="!codiceFiscaleOk" class="nota-errore">16 caratteri (persona fisica) oppure uguale alla Partita IVA (società).</small>
          </div>
          <div class="field"><label>Regime Fiscale</label><input v-model="modelValue.regimeFiscale" disabled title="Forfettario: RF19"></div>
          <div class="field"><label>Indirizzo</label><input v-model="modelValue.indirizzo"></div>
          <div class="field"><label>Numero civico</label><input v-model="modelValue.numeroCivico"></div>
          <div class="field"><label>CAP</label><input v-model="modelValue.cap"></div>
          <div class="field"><label>Comune</label><input v-model="modelValue.comune"></div>
          <div class="field"><label>Provincia</label><input v-model="modelValue.provincia" maxlength="2" style="text-transform:uppercase"></div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:0">
      <div class="card-head"><h2>Regime forfettario</h2></div>
      <div class="card-body">
        <div class="form-grid">
          <div class="field"><label>Soglia fatturato annuo (€)</label><input type="number" step="1" min="1" v-model.number="forfettario.sogliaAnnua"></div>
          <div class="field"><label>Data inizio attività</label><input type="date" v-model="forfettario.dataInizioAttivita"></div>
          <div class="field field-full" style="position:relative">
            <label style="display:flex;align-items:center;gap:8px">
              Codice ATECO
              <button
                type="button"
                class="btn-icon"
                title="Aggiorna elenco codici ATECO e coefficienti da Gemini"
                aria-label="Aggiorna elenco codici ATECO e coefficienti da Gemini"
                :disabled="aggiornando"
                @click="aggiornaElencoAteco"
              >{{ aggiornando ? '…' : '⟳' }}</button>
              <span v-if="messaggioAggiorna" class="badge-mono" style="font-weight:normal">{{ messaggioAggiorna }}</span>
            </label>
            <input type="text" v-model="ricerca" placeholder="Cerca per codice, descrizione o settore… (anche sotto-codici es. 62.20.10)" autocomplete="off">
            <ul v-if="risultati.length" class="ateco-risultati">
              <li
                v-for="c in risultati" :key="c.codice"
                role="button" tabindex="0"
                @click="selezionaCodice(c)"
                @keydown.enter="selezionaCodice(c)"
                @keydown.space.prevent="selezionaCodice(c)"
              >
                <strong>{{ c.codice }}</strong> — {{ c.descrizione }}
                <span class="ateco-settore">{{ c.settore }} · {{ c.coefficente }}%</span>
              </li>
            </ul>
          </div>
          <div class="field"><label>Settore</label><input type="text" v-model="forfettario.settoreAteco" readonly></div>
          <div class="field"><label>Coefficiente di redditività (%)</label><input type="number" step="1" min="0" max="100" v-model.number="forfettario.coefficenteRedditivita"></div>
        </div>
        <p class="note-legal" style="margin-top:16px">
          Aliquota imposta sostitutiva: 5% nei primi 5 anni solari dall'inizio attività, 15% dal sesto anno.
          Il coefficiente si auto-compila selezionando il codice ATECO, ma resta modificabile.
        </p>
      </div>
    </div>

    <div class="card" style="margin-bottom:0">
      <div class="card-head"><h2>₿ Wallet Bitcoin</h2></div>
      <div class="card-body">
        <p class="note-legal">Indirizzi proposti come destinazione quando registri un incasso in BTC su una fattura. Il primo è quello precompilato di default.</p>
        <div v-for="(w, i) in walletBtc" :key="i" class="form-grid" style="align-items:end;margin-top:8px">
          <div class="field"><label>Etichetta</label><input v-model="w.etichetta" placeholder="es. Wallet principale"></div>
          <div class="field">
            <label>Indirizzo</label>
            <div style="display:flex;gap:6px">
              <input v-model="w.indirizzo" placeholder="bc1..." style="flex:1">
              <button type="button" class="btn-icon" title="Rimuovi" aria-label="Rimuovi indirizzo" @click="rimuoviWalletBtc(i)">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>
            </div>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:8px">
          <button type="button" class="btn btn-ghost" @click="aggiungiWalletBtc">+ Aggiungi indirizzo</button>
          <button type="button" class="btn btn-primary" @click="$emit('salva-subito')">Salva</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.btn-icon {
  border: 1px solid var(--line); background: var(--card); color: var(--ink);
  border-radius: var(--radius-sm); width: 24px; height: 24px; line-height: 1; cursor: pointer;
  font-size: .95rem; display: inline-flex; align-items: center; justify-content: center;
}
.btn-icon:disabled { opacity: .5; cursor: default; }
.ateco-risultati {
  position: absolute; top: 100%; left: 0; right: 0; z-index: 10;
  background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-md);
  max-height: 260px; overflow-y: auto; list-style: none; margin: 4px 0 0; padding: 4px;
  box-shadow: var(--shadow);
}
.ateco-risultati li { padding: 8px 10px; border-radius: var(--radius-sm); cursor: pointer; font-size: .85rem; color: var(--ink); }
.ateco-risultati li:hover { background: var(--ground); }
.ateco-settore { display: block; font-size: .74rem; color: var(--muted); margin-top: 2px; }
</style>
