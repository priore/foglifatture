<script setup>
// Anagrafica fornitore, regime forfettario, INPS, bollo e dati di pagamento in un'unica pagina (card per
// categoria): sono lo stesso soggetto fiscale, l'utente li compila/verifica insieme invece che in step separati.
import { ref, onMounted, computed, watch } from 'vue';
import LogoUpload from './LogoUpload.vue';
import { pivaValida, codiceFiscaleValido } from '../../composables/useValidazioneFiscale.js';
import { api } from '../../services/api.js';
import { renderMarkdown } from '../../composables/useMarkdown.js';

const props = defineProps({
  modelValue: { type: Object, required: true }, // config.fornitore
  forfettario: { type: Object, required: true }, // config.forfettario
  fatturazione: { type: Object, required: true }, // config.fatturazione: bollo e dati di pagamento
  walletBtc: { type: Array, required: true }, // config.walletBtc: [{ etichetta, indirizzo }]
  importBtc: { type: Object, required: true }, // config.importBtc: import automatico transazioni (FP-014)
});
// Indirizzo di default proposto negli incassi BTC (AI-Workspace/Plans/PAGAMENTI_BTC.md, F2):
// un solo indirizzo principale, gestito qui come primo elemento dell'array.
function aggiungiWalletBtc() {
  props.walletBtc.push({ etichetta: '', indirizzo: '' });
}
function rimuoviWalletBtc(indice) {
  props.walletBtc.splice(indice, 1);
}

// Tab: il salvataggio resta unico (pulsante Salva del wizard), le card restano tutte nel DOM (v-show).
const TABS = ['Anagrafica', 'Fiscale', 'Fatturazione'];
const tabAttivo = ref(TABS[0]);

const partitaIvaOk = computed(() => pivaValida(props.modelValue.partitaIva));
const codiceFiscaleOk = computed(() => codiceFiscaleValido(props.modelValue.codiceFiscale));

const codici = ref([]);
const ricerca = ref('');
const aggiornando = ref(false);
const messaggioAggiorna = ref('');
const spiegaRequisitiInCorso = ref(false);
const popupAI = ref(null); // { titolo, testo }

// Codice sede INPS (J.1): elenco ufficiale AdE in popup con ricerca testuale.
const sedi = ref([]);
const popupSedi = ref(false);
const ricercaSede = ref('');
const sedeAttuale = computed(() => sedi.value.find((s) => s.codice === props.forfettario.codiceSedeInps));
const sediFiltrate = computed(() => {
  const t = ricercaSede.value.trim().toLowerCase();
  return t ? sedi.value.filter((s) => s.codice.includes(t) || s.nome.toLowerCase().includes(t)) : sedi.value;
});
const erroreSedi = ref('');
async function apriPopupSedi() {
  erroreSedi.value = '';
  if (!sedi.value.length) {
    try {
      const elenco = await api.sediInps();
      if (!Array.isArray(elenco?.sedi)) throw new Error('risposta non valida (riavviare il backend?)');
      sedi.value = elenco.sedi;
    } catch (err) {
      erroreSedi.value = `Elenco sedi non disponibile: ${err.message}`;
    }
  }
  ricercaSede.value = '';
  popupSedi.value = true;
}
function scegliSede(codice) {
  props.forfettario.codiceSedeInps = codice;
  popupSedi.value = false;
}

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

async function spiegaRequisitiConAI() {
  spiegaRequisitiInCorso.value = true;
  try {
    const r = await api.spiegaRequisitiAliquotaRidotta();
    popupAI.value = { titolo: 'Requisiti aliquota 5% — Spiegazione AI', testo: r.spiegazione };
  } catch (err) {
    popupAI.value = { titolo: 'Spiegazione AI', testo: err.message };
  } finally {
    spiegaRequisitiInCorso.value = false;
  }
}

function selezionaCodice(c) {
  props.forfettario.codiceAteco = c.codice;
  props.forfettario.settoreAteco = c.settore;
  props.forfettario.coefficenteRedditivita = c.coefficente;
  ricerca.value = `${c.codice} — ${c.descrizione}`;
}
</script>

<template>
  <div class="tab-toggle">
    <button v-for="t in TABS" :key="t" type="button" :class="tabAttivo === t ? 'btn btn-primary' : 'btn btn-ghost'" @click="tabAttivo = t">{{ t }}</button>
  </div>
  <div class="tab-pannello" v-show="tabAttivo === 'Anagrafica'">
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

  </div>
  <div class="tab-pannello" v-show="tabAttivo === 'Fiscale'">
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
          <div class="field"><label>Coefficiente di redditività (%)</label><input type="number" step="1" min="0" max="100" v-model.number="forfettario.coefficenteRedditivita">
            <small class="note-legal" style="margin-top:6px">Si auto-compila selezionando il codice ATECO, ma resta modificabile.</small>
          </div>
          <div class="field full">
            <div style="display:flex;align-items:center;gap:8px">
              <input id="altre-attivita-coefficiente" type="checkbox" v-model="forfettario.altreAttivitaCoefficienteDiverso" class="checkbox-app">
              <label for="altre-attivita-coefficiente" style="margin:0">Ho altre attività con coefficiente di redditività diverso</label>
            </div>
            <small class="note-legal" style="margin-top:6px;display:block">L'app applica a tutti i ricavi il coefficiente indicato sopra, senza distinguere le attività: reddito, imposta e acconti stimati non tengono conto degli altri coefficienti.</small>
          </div>
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
                <small class="note-legal" style="margin-top:6px;display:block">L. 190/2014 c. 65: nessuna attività d'impresa o professionale nei 3 anni precedenti e l'attività non prosegue un lavoro dipendente. Se non spuntato, l'imposta stimata usa il 15% (scelta prudente).</small>
                <div style="display:flex;justify-content:flex-end;margin-top:6px">
                  <button type="button" class="btn-ai" :disabled="spiegaRequisitiInCorso" @click="spiegaRequisitiConAI">{{ spiegaRequisitiInCorso ? '…' : 'Spiega con AI' }}</button>
                </div>
              </div>
              <div class="field" style="margin:0">
                <div style="display:flex;align-items:center;gap:8px">
                  <input id="soggetto-isa" type="checkbox" v-model="forfettario.soggettoIsa" class="checkbox-app">
                  <label for="soggetto-isa" style="margin:0">Soggetto a ISA (indici sintetici di affidabilità)</label>
                </div>
                <small class="note-legal" style="margin-top:6px">DPR 435/2001 art. 17 c. 3: gli acconti sono versati in due rate uguali (50% + 50%). Deselezionare solo se il proprio codice ATECO non ha ISA approvato (40% + 60%). Quasi tutti i forfettari hanno ISA.</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:0">
      <div class="card-head"><h2>INPS</h2></div>
      <div class="card-body">
        <div class="form-grid">
          <div class="field">
            <label for="gestione-previdenziale">Gestione previdenziale</label>
            <select id="gestione-previdenziale" v-model="forfettario.gestionePrevidenziale">
              <option value="">Non configurata (INPS non stimato)</option>
              <option value="gestioneSeparata">INPS gestione separata</option>
              <option value="altra">Altra (artigiani/commercianti/cassa professionale — non stimata)</option>
            </select>
            <small class="note-legal" style="margin-top:6px">Necessaria per stimare i contributi INPS nelle scadenze F24. Per i liberi professionisti senza altra copertura obbligatoria si applica la gestione separata INPS (aliquota 26,07%).</small>
          </div>
          <div class="field" v-if="forfettario.gestionePrevidenziale === 'gestioneSeparata'">
            <label for="codice-sede-inps">Codice sede INPS</label>
            <div style="display:flex;gap:6px">
              <input id="codice-sede-inps" type="text" readonly style="flex:1"
                :value="forfettario.codiceSedeInps ? `${forfettario.codiceSedeInps}${sedeAttuale ? ' — ' + sedeAttuale.nome : ''}` : ''"
                placeholder="Non selezionato" @click="apriPopupSedi">
              <button type="button" class="btn btn-ghost" @click="apriPopupSedi">Scegli…</button>
            </div>
            <small class="note-legal" style="margin-top:6px">Sede INPS della tua posizione contributiva: viene scritta nella sezione INPS dell'F24. Elenco ufficiale Agenzia delle Entrate.</small>
          </div>
          <div class="field" v-if="forfettario.gestionePrevidenziale === 'gestioneSeparata'">
            <div style="display:flex;align-items:center;gap:8px">
              <input id="altra-copertura-previdenziale" type="checkbox" v-model="forfettario.altraCoperturaPrevidenziale" class="checkbox-app">
              <label for="altra-copertura-previdenziale" style="margin:0">Pensionato o iscritto ad altra previdenza obbligatoria (aliquota GS ridotta 24%)</label>
            </div>
            <small class="note-legal" style="margin-top:6px">Circ. INPS 62/2026 §2.1: chi ha un'altra copertura previdenziale obbligatoria paga il 24% invece del 26,07%.</small>
          </div>
          <div class="field">
            <div style="display:flex;align-items:center;gap:8px">
              <input id="rivalsa-inps" type="checkbox" v-model="forfettario.rivalsaInps" class="checkbox-app">
              <label for="rivalsa-inps" style="margin:0">Rivalsa INPS 4% addebitata al cliente</label>
            </div>
            <small class="note-legal" style="margin-top:6px">L. 662/96 art. 1 c. 212: aggiunge in fattura il 4% del compenso a carico del cliente. Facoltativa, da concordare. Il 4% conta come ricavo ai fini della soglia. Concorre anche al totale del documento ai fini dell'imposta di bollo (€ 2 sopra 77,47 €). Disabilitabile per singolo cliente nelle impostazioni clienti.</small>
          </div>
        </div>
      </div>
    </div>

  </div>
  <div class="tab-pannello" v-show="tabAttivo === 'Fatturazione'">
    <div class="card" style="margin-bottom:0">
      <div class="card-head"><h2>Bollo virtuale</h2></div>
      <div class="card-body">
        <div class="form-grid">
          <div class="field"><label>Soglia bollo virtuale (€)</label><input type="number" step="0.01" v-model.number="fatturazione.sogliaBolloVirtuale"></div>
          <div class="field"><label>Importo bollo (€)</label><input type="number" step="0.01" v-model.number="fatturazione.importoBollo"></div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:0">
      <div class="card-head"><h2>Dati di pagamento in fattura</h2></div>
      <div class="card-body">
        <p class="note-legal">Se l'IBAN è compilato, ogni nuova fattura riporta modalità, IBAN e scadenza (blocco DatiPagamento). Vuoto = nessun dato di pagamento in XML.</p>
        <div class="form-grid">
          <div class="field"><label>IBAN</label><input type="text" v-model="fatturazione.iban" placeholder="IT60 X054 2811 1010 0000 0123 456"></div>
          <div class="field"><label>Intestatario conto</label><input type="text" v-model="fatturazione.intestatario"></div>
          <div class="field"><label>Istituto finanziario (facoltativo)</label><input type="text" v-model="fatturazione.istitutoFinanziario"></div>
          <div class="field"><label>Modalità predefinita</label>
            <select v-model="fatturazione.modalitaDefault">
              <option value="MP05">Bonifico</option>
              <option value="MP19">Addebito diretto SEPA</option>
              <option value="MP08">Carta di pagamento</option>
              <option value="MP02">Assegno</option>
              <option value="MP01">Contanti</option>
              <option value="BTC">Bitcoin (indirizzo dal primo wallet in Fornitore)</option>
            </select>
          </div>
          <div class="field"><label>Giorni di scadenza predefiniti</label><input type="number" min="0" v-model.number="fatturazione.giorniScadenzaDefault"></div>
        </div>
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

        <h3 class="sotto-titolo">Import automatico transazioni</h3>
        <p class="note-legal">
          Controlla periodicamente gli indirizzi qui sopra (mai altri) e propone le transazioni nuove nella vista Bitcoin (Importa BTC):
          nulla viene registrato senza la tua conferma.
        </p>
        <p class="note-legal">
          Privacy: ogni indirizzo configurato, insieme al tuo indirizzo IP, viene inviato sia al provider primario sia a quello di riserva
          (per confrontarne le risposte). Per evitarlo indica l'URL del tuo nodo.
        </p>
        <div class="field full riga-check">
          <input id="import-btc-privacy" type="checkbox" class="checkbox-app" v-model="importBtc.avvisoPrivacyAccettato">
          <label for="import-btc-privacy">Ho letto l'avviso privacy e accetto l'invio degli indirizzi ai provider</label>
        </div>
        <div class="field full riga-check">
          <input id="import-btc-abilitato" type="checkbox" class="checkbox-app" v-model="importBtc.abilitato" :disabled="!importBtc.avvisoPrivacyAccettato || !walletBtc.length">
          <label for="import-btc-abilitato">Controllo automatico attivo</label>
        </div>
        <p v-if="!importBtc.avvisoPrivacyAccettato || !walletBtc.length" class="note-legal">
          Per attivarlo servono almeno un indirizzo wallet e l'accettazione dell'avviso privacy.
        </p>
        <div class="form-grid riga-import">
          <div class="field"><label for="import-btc-intervallo">Controlla ogni (minuti)</label><input id="import-btc-intervallo" type="number" min="1" v-model.number="importBtc.intervalloMinuti"></div>
          <div class="field"><label for="import-btc-conferme">Conferme minime</label><input id="import-btc-conferme" type="number" min="1" v-model.number="importBtc.confermeMinime"></div>
          <div class="field"><label for="import-btc-primario">URL provider primario</label><input id="import-btc-primario" type="url" v-model="importBtc.urlPrimario"></div>
          <div class="field"><label for="import-btc-riserva">URL provider di riserva</label><input id="import-btc-riserva" type="url" v-model="importBtc.urlFallback"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- Popup elenco sedi INPS (J.1) -->
  <Teleport to="body">
    <div v-if="popupSedi" class="ai-overlay" @click.self="popupSedi = false">
      <div class="ai-popup" role="dialog" aria-modal="true">
        <div class="ai-popup-header">
          <span class="ai-popup-titolo">Codice sede INPS</span>
          <button class="btn-chiudi" @click="popupSedi = false" aria-label="Chiudi">✕</button>
        </div>
        <div class="ai-popup-body">
          <div class="field" style="margin-bottom:8px">
            <input type="text" v-model="ricercaSede" placeholder="Cerca per nome o codice…" autocomplete="off" aria-label="Cerca sede INPS">
          </div>
          <p v-if="erroreSedi" class="note-legal">{{ erroreSedi }}</p>
          <ul class="ateco-risultati" style="position:static;max-height:none;box-shadow:none;border:0;margin:0;padding:0">
            <li v-for="(s, i) in sediFiltrate" :key="s.codice + i" @click="scegliSede(s.codice)">
              <strong>{{ s.codice }}</strong> — {{ s.nome }}
            </li>
            <li v-if="!sediFiltrate.length" style="cursor:default">Nessuna sede trovata</li>
          </ul>
        </div>
        <div class="ai-popup-footer"><button class="btn btn-ghost" @click="popupSedi = false">Chiudi</button></div>
      </div>
    </div>
  </Teleport>

  <!-- Popup spiegazione AI (B.5 requisiti aliquota, riusabile) -->
  <Teleport to="body">
    <div v-if="popupAI" class="ai-overlay" @click.self="popupAI = null">
      <div class="ai-popup" role="dialog" aria-modal="true">
        <div class="ai-popup-header">
          <span class="ai-popup-titolo">{{ popupAI.titolo }}</span>
          <button class="btn-chiudi" @click="popupAI = null" aria-label="Chiudi">✕</button>
        </div>
        <div class="ai-popup-body"><div class="ai-popup-testo" v-html="renderMarkdown(popupAI.testo)"></div></div>
        <div class="ai-popup-footer"><button class="btn btn-ghost" @click="popupAI = null">Chiudi</button></div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.tab-toggle { display: flex; gap: 8px; margin-bottom: 20px; }
.tab-pannello { display: flex; flex-direction: column; gap: 20px; }
.checkbox-row {
  display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
}
.ateco-risultati {
  position: absolute; top: 100%; left: 0; right: 0; z-index: 10;
  background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-md);
  max-height: 260px; overflow-y: auto; list-style: none; margin: 4px 0 0; padding: 4px;
  box-shadow: var(--shadow);
}
.ateco-risultati li { padding: 8px 10px; border-radius: var(--radius-sm); cursor: pointer; font-size: .85rem; color: var(--ink); }
.ateco-risultati li:hover { background: var(--ground); }
.ateco-settore { display: block; font-size: .74rem; color: var(--muted); margin-top: 2px; }
/* btn-ai, btn-icon definiti in style.css globale */
.sotto-titolo { margin: 20px 0 4px; font-size: var(--font-size-md); }
.riga-check { flex-direction: row; align-items: center; gap: var(--gap-sm); margin-top: var(--gap-sm); }
.riga-check label { margin: 0; }
.riga-import { margin-top: var(--gap-sm); }
</style>
