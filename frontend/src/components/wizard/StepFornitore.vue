<script setup>
// Anagrafica fornitore e regime forfettario in un'unica pagina (2 pannelli): sono lo
// stesso soggetto fiscale, l'utente li compila/verifica insieme invece che in step separati.
import { ref, onMounted, computed, watch } from 'vue';
import LogoUpload from './LogoUpload.vue';
import { pivaValida, codiceFiscaleValido } from '../../composables/useValidazioneFiscale.js';
import { api } from '../../services/api.js';

const props = defineProps({
  modelValue: { type: Object, required: true }, // config.fornitore
  forfettario: { type: Object, required: true }, // config.forfettario
  walletBtc: { type: Array, required: true }, // config.walletBtc: [{ etichetta, indirizzo }]
});
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

// Aliquota agevolata: eligibile solo se dataInizioAttivita è impostata e l'attività
// è nei primi 5 anni solari (anno inizio incluso). Fuori da questa finestra il flag
// non ha alcun effetto fiscale, quindi viene disabilitato e azzerato.
const annoCorrente = new Date().getFullYear();
const requisitiEligibili = computed(() => {
  const d = props.forfettario.dataInizioAttivita;
  if (!d) return false;
  const annoInizio = new Date(d).getFullYear();
  return (annoCorrente - annoInizio) < 5;
});

watch(requisitiEligibili, (ok) => {
  if (!ok) props.forfettario.requisitiAliquotaRidotta = false;
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
          <div class="field full">
            <div style="display:flex;align-items:center;gap:8px">
              <input id="iscritto-vies" type="checkbox" v-model="modelValue.iscrittoVies" class="checkbox-app">
              <label for="iscritto-vies" style="margin:0">Iscritto al VIES (necessario per fatturare con inversione contabile ad aziende UE)</label>
            </div>
            <small class="note-legal" style="margin-top:4px">L'iscrizione al VIES consente di applicare la non imponibilità IVA (art. 7-ter DPR 633/72) alle prestazioni verso aziende UE. Senza iscrizione compare un avviso in bozza fattura ma non viene bloccata l'emissione.</small>
          </div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:0">
      <div class="card-head"><h2>Regime forfettario</h2></div>
      <div class="card-body">
        <div class="form-grid">
          <div class="field"><label>Soglia fatturato annuo (€)</label><input type="number" step="1" min="1" v-model.number="forfettario.sogliaAnnua"></div>
          <div class="field">
            <label>Limite personale di sicurezza (€)</label>
            <input type="number" step="1" min="0" v-model.number="forfettario.limitePersonale" placeholder="0 = disabilitato">
            <small class="note-legal" style="margin-top:4px">Soglia personale opzionale (es. 80.000 €): superarla richiede conferma prima di generare la fattura. Indipendente dalla soglia di legge.</small>
          </div>
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
          <div class="field full">
            <div class="checkbox-row">
              <div class="field" style="margin:0">
                <div style="display:flex;align-items:center;gap:8px">
                  <input id="requisiti-aliquota-ridotta" type="checkbox" v-model="forfettario.requisitiAliquotaRidotta" class="checkbox-app" :disabled="!requisitiEligibili">
                  <label for="requisiti-aliquota-ridotta" style="margin:0" :style="!requisitiEligibili ? 'opacity:.45' : ''">Ho i requisiti per l'aliquota agevolata del 5%</label>
                </div>
                <small v-if="!requisitiEligibili" class="note-legal" style="margin-top:6px">
                  {{ forfettario.dataInizioAttivita ? 'Attività avviata da più di 5 anni: aliquota ordinaria 15% applicata.' : 'Inserisci la data di inizio attività per verificare l\'eligibilità.' }}
                </small>
                <small v-else class="note-legal" style="margin-top:6px">L. 190/2014 c. 65: nessuna attività d'impresa o professionale nei 3 anni precedenti e l'attività non prosegue un lavoro dipendente. Se non spuntato, l'imposta stimata usa il 15% (scelta prudente).</small>
              </div>
              <div class="field" style="margin:0">
                <div style="display:flex;align-items:center;gap:8px">
                  <input id="soggetto-isa" type="checkbox" v-model="forfettario.soggettoIsa" class="checkbox-app">
                  <label for="soggetto-isa" style="margin:0">Soggetto a ISA (indici sintetici di affidabilità)</label>
                </div>
                <small class="note-legal" style="margin-top:6px">DPR 435/2001 art. 17 c. 3: gli acconti sono versati in due rate uguali (50% + 50%). Deselezionare solo se il proprio codice ATECO non ha ISA approvato (40% + 60%). Quasi tutti i forfettari hanno ISA.</small>
              </div>
              <div class="field" style="margin:0">
                <div style="display:flex;align-items:center;gap:8px">
                  <input id="rivalsa-inps" type="checkbox" v-model="forfettario.rivalsaInps" class="checkbox-app">
                  <label for="rivalsa-inps" style="margin:0">Rivalsa INPS 4% addebitata al cliente</label>
                </div>
                <small class="note-legal" style="margin-top:6px">L. 662/96 art. 1 c. 212: aggiunge in fattura il 4% del compenso a carico del cliente. Facoltativa, da concordare. Il 4% conta come ricavo ai fini della soglia. Disabilitabile per singolo cliente nelle impostazioni clienti.</small>
              </div>
            </div>
          </div>
        </div>
        <p class="note-legal" style="margin-top:16px">
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
        <div style="margin-top:8px">
          <button type="button" class="btn btn-ghost" @click="aggiungiWalletBtc">+ Aggiungi indirizzo</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.checkbox-row {
  display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
}
.checkbox-app {
  appearance: none; width: 18px; height: 18px; border: 1px solid var(--line);
  border-radius: var(--radius-sm); background: none; cursor: pointer; flex-shrink: 0;
  margin: 0; position: relative;
}
.checkbox-app:checked { background: var(--accent); border-color: var(--accent); }
.checkbox-app:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.checkbox-app:checked::after {
  content: ''; position: absolute; top: 45%; left: 50%;
  transform: translate(-50%, -50%) rotate(45deg);
  width: 5px; height: 9px; border: solid var(--accent-ink); border-width: 0 2px 2px 0;
}
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
