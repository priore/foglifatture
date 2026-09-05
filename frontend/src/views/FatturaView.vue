<script setup>
// Schermata Fattura Pro-Forma: calcolo automatico da timesheet, generazione XML FatturaPA,
// invio PEC. Il calcolo compenso è ricavato dal backend (unica fonte di verità sui totali).
import { ref, computed, watch, onMounted } from 'vue';
import MonthSwitcher from '../components/common/MonthSwitcher.vue';
import ClienteSwitcher from '../components/common/ClienteSwitcher.vue';
import TemplateStampa from '../components/common/TemplateStampa.vue';
import { api } from '../services/api.js';
import { esportaPdf, generaPdfBlob } from '../composables/usePdfExport.js';
import { inviaPdfEmail } from '../composables/useMailto.js';
import { preparaDatiFattura } from '../composables/useTemplateData.js';

const oggi = new Date();
const anno = ref(oggi.getFullYear());
const mese = ref(oggi.getMonth() + 1);
const config = ref(null);
const clienteId = ref(null);
const anteprima = ref(null);
const fatturaGenerata = ref(null);
const anteprimaRef = ref(null);
const inviandoPec = ref(false);
const esitoPec = ref('');
const meseMinimo = ref(null);
const controllandoSdi = ref(false);
const esitoSdi = ref('');
const ricevuteSdi = ref([]);
const inviandoEmail = ref(false);
const esitoEmail = ref('');

// Fattura manuale: importo e dicitura liberi, nessun calcolo da timesheet.
const modoManuale = ref(false);
const importoManuale = ref(0);
const descrizioneManuale = ref('');
const dataFattura = ref('');
const dataScadenzaPagamento = ref('');
const salvandoScadenza = ref(false);

const importoValido = computed(() => Number.isFinite(Number(importoManuale.value)) && Number(importoManuale.value) > 0);

function dataDefault() {
  return `${anno.value}-${String(mese.value).padStart(2, '0')}-28`;
}

const clientiAttivi = computed(() => config.value?.clienti.filter(c => c.attivo) ?? []);
const clienteCorrente = computed(() => clientiAttivi.value.find(c => c.id === clienteId.value) ?? null);

// Fatture storiche importate da XML possono avere una descrizione salvata senza il
// totale ore (fedele al documento originale emesso): a video, solo per leggibilità,
// si integra il dato ore preso da oreTotali se non già menzionato nel testo.
const descrizioneVisualizzata = computed(() => {
  if (modoManuale.value) return descrizioneManuale.value;
  const descrizioneSalvata = fatturaGenerata.value?.descrizione;
  const oreTotali = fatturaGenerata.value?.oreTotali ?? anteprima.value?.totaleOre;
  if (descrizioneSalvata) {
    if (/ore/i.test(descrizioneSalvata) || oreTotali == null) return descrizioneSalvata;
    return `${descrizioneSalvata} per un totale di ${oreTotali.toFixed(2)} ore mensili.`;
  }
  return `Servizi di Informatica prestati per vs. Azienda conto terzi per un totale di ${(anteprima.value?.totaleOre ?? 0).toFixed(2)} ore mensili.`;
});

const anteprimaEffettiva = computed(() => {
  // Fattura già salvata (generata o importata da XML): mostra i valori congelati,
  // non ricalcolare dal timesheet corrente — che per un mese storico può essere vuoto.
  if (fatturaGenerata.value) return fatturaGenerata.value;
  if (!modoManuale.value) return anteprima.value;
  if (!config.value) return null;
  const imponibile = Number((Number(importoManuale.value) || 0).toFixed(2));
  const bolloApplicabile = imponibile > config.value.fatturazione.sogliaBolloVirtuale;
  const bollo = bolloApplicabile ? config.value.fatturazione.importoBollo : 0;
  return { imponibile, bolloApplicabile, bollo, nettoAPagare: imponibile };
});

const templateIdFattura = computed(() => clienteCorrente.value?.templateFatturaId || 'fattura-default');
const datiFattura = computed(() => {
  if (!config.value || !clienteCorrente.value || !anteprimaEffettiva.value) return null;
  return preparaDatiFattura({
    fornitore: config.value.fornitore,
    cliente: clienteCorrente.value,
    numero: fatturaGenerata.value?.numero ?? '—',
    data: fatturaGenerata.value?.data ?? dataFattura.value,
    descrizione: descrizioneVisualizzata.value,
    imponibile: anteprimaEffettiva.value.imponibile,
    bollo: anteprimaEffettiva.value.bollo,
    bolloApplicabile: anteprimaEffettiva.value.bolloApplicabile,
    nettoAPagare: anteprimaEffettiva.value.nettoAPagare,
  });
});

async function caricaAnteprima() {
  if (!clienteId.value) return;
  anteprima.value = await api.anteprimaFattura(anno.value, mese.value, clienteId.value);
  fatturaGenerata.value = await api.getFattura(anno.value, mese.value, clienteId.value);
  dataFattura.value = fatturaGenerata.value?.data ?? dataDefault();
  dataScadenzaPagamento.value = fatturaGenerata.value?.dataScadenzaPagamento ?? '';
  await caricaRicevuteSdi();
}

async function caricaRicevuteSdi() {
  ricevuteSdi.value = fatturaGenerata.value ? await api.ricevuteSdiFattura(anno.value, mese.value, clienteId.value) : [];
}

async function aggiornaMeseMinimo() {
  const [mesiTimesheet, mesiFatture] = await Promise.all([api.listMesiTimesheet(), api.listMesiFatturati()]);
  const chiavi = [...mesiTimesheet, ...mesiFatture]
    .filter(m => m.clienteId === clienteId.value)
    .map(m => m.chiave.slice(0, 7));
  meseMinimo.value = chiavi.length ? chiavi.sort()[0] : null;
}

async function generaFattura() {
  const dati = modoManuale.value
    ? { importo: Number(importoManuale.value), descrizione: descrizioneManuale.value, data: dataFattura.value }
    : { data: dataFattura.value };
  fatturaGenerata.value = await api.generaFattura(anno.value, mese.value, clienteId.value, dati);
  dataFattura.value = fatturaGenerata.value?.data ?? dataFattura.value;
  await caricaRicevuteSdi();
}

async function salvaScadenzaPagamento() {
  salvandoScadenza.value = true;
  try {
    fatturaGenerata.value = await api.impostaScadenzaPagamento(anno.value, mese.value, clienteId.value, dataScadenzaPagamento.value || null);
  } finally {
    salvandoScadenza.value = false;
  }
}

async function scaricaXml() {
  window.open(api.urlDownloadXml(anno.value, mese.value, clienteId.value), '_blank');
}

// L'ultima ricevuta (ricevuteSdi è ordinata più recente prima) è una notifica di
// scarto: un nuovo invio è un vero REinvio, non il primo. Chiede conferma esplicita
// perché consuma comunque un nuovo ProgressivoInvio SDI.
const ultimoScarto = computed(() => ricevuteSdi.value[0]?.tipo === 'NS' ? ricevuteSdi.value[0] : null);

// Fattura accettata dallo SDI: emessa e non più modificabile per legge (Circolare
// Agenzia Entrate 13/E/2018). Stesso criterio del backend in invoiceRoutes.js.
const TIPI_ACCETTAZIONE_SDI = new Set(['RC', 'DT', 'EC']);
const fatturaAccettataSdi = computed(() =>
  fatturaGenerata.value?.importataDaStorico || TIPI_ACCETTAZIONE_SDI.has(ricevuteSdi.value[0]?.tipo)
);

async function inviaPec() {
  if (ultimoScarto.value) {
    const motivo = ultimoScarto.value.errori?.[0]?.descrizione ?? 'motivo non disponibile';
    if (!window.confirm(`La fattura è stata scartata da SDI (${motivo}).\n\nReinviare con un nuovo progressivo di trasmissione?`)) return;
  }
  inviandoPec.value = true;
  esitoPec.value = '';
  try {
    const risultato = await api.inviaPec(anno.value, mese.value, clienteId.value);
    esitoPec.value = risultato.inviato ? 'Inviata con successo' : `Errore: ${risultato.errore}`;
    await caricaRicevuteSdi();
  } catch (err) {
    esitoPec.value = `Errore: ${err.message}`;
  } finally {
    inviandoPec.value = false;
  }
}

function inizializzaClienteId() {
  const salvato = localStorage.getItem('clienteAttivoId');
  clienteId.value = clientiAttivi.value.some(c => c.id === salvato)
    ? salvato
    : clientiAttivi.value[0]?.id ?? null;
}
watch(clienteId, (id) => { if (id) localStorage.setItem('clienteAttivoId', id); });

async function controllaSdi() {
  controllandoSdi.value = true;
  esitoSdi.value = '';
  try {
    const risultato = await api.controllaRicevuteSdi();
    esitoSdi.value = risultato.errore ? `Errore: ${risultato.errore}` : `${risultato.nuove} nuovo/i documento/i`;
    await caricaRicevuteSdi();
  } catch (err) {
    esitoSdi.value = `Errore: ${err.message}`;
  } finally {
    controllandoSdi.value = false;
  }
}

async function esporta() {
  await esportaPdf(anteprimaRef.value.contentDocument().body, `fattura-${anno.value}-${String(mese.value).padStart(2, '0')}.pdf`);
}

async function inviaEmail() {
  inviandoEmail.value = true;
  esitoEmail.value = '';
  try {
    const pdfBlob = await generaPdfBlob(anteprimaRef.value.contentDocument().body);
    const nomeFile = `fattura-${anno.value}-${String(mese.value).padStart(2, '0')}.pdf`;
    const oggetto = `Fattura ${fatturaGenerata.value?.numero ?? ''} — ${String(mese.value).padStart(2, '0')}/${anno.value}`;
    const corpo = `Buongiorno,\n\nin allegato la fattura relativa al mese di ${String(mese.value).padStart(2, '0')}/${anno.value}.\n\nCordiali saluti.`;
    const risultato = await inviaPdfEmail(pdfBlob, nomeFile, clienteCorrente.value.email, oggetto, corpo);
    esitoEmail.value = risultato.modalita === 'mail-app-mac'
      ? 'Bozza aperta in Mail con allegato pronto'
      : 'PDF salvato e rivelato nel file manager: trascinalo nella mail appena aperta';
  } catch (err) {
    esitoEmail.value = `Errore: ${err.message}`;
  } finally {
    inviandoEmail.value = false;
  }
}

watch([anno, mese, clienteId], caricaAnteprima);
onMounted(async () => {
  config.value = await api.getConfig();
  inizializzaClienteId();
  await caricaAnteprima();
  await aggiornaMeseMinimo();
});
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1>Fattura Pro-Forma</h1>
        <p>{{ modoManuale ? 'Importo e dicitura liberi' : 'Generata da Timesheet · Tariffa oraria configurabile in Impostazioni' }}</p>
      </div>
    </div>
    <div class="cliente-row" v-if="clientiAttivi.length">
      <ClienteSwitcher v-model="clienteId" :clienti="clientiAttivi" />
    </div>
    <div class="actions" style="margin-bottom:16px">
      <MonthSwitcher v-model:anno="anno" v-model:mese="mese" :mese-minimo="meseMinimo" />
      <button class="btn btn-ok" @click="esporta">Scarica PDF</button>
    </div>

    <div class="two-col" style="display:grid;grid-template-columns:340px 1fr;gap:24px;align-items:start" v-if="anteprima && config && clienteCorrente">
      <div>
        <div class="card">
          <div class="card-head"><h2>Tipo fattura</h2></div>
          <div class="card-body" style="display:flex;gap:16px">
            <label style="display:flex;align-items:center;gap:6px"><input type="radio" :value="false" v-model="modoManuale" /> Da timesheet</label>
            <label style="display:flex;align-items:center;gap:6px"><input type="radio" :value="true" v-model="modoManuale" /> Importo libero</label>
          </div>
        </div>

        <div class="card" v-if="modoManuale">
          <div class="card-head"><h2>Importo e dicitura</h2></div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:14px">
            <div class="field">
              <label>Importo (€)</label>
              <input type="number" step="0.01" min="0" v-model="importoManuale" :class="{ 'campo-non-valido': !importoValido }" />
              <small v-if="!importoValido" class="nota-errore">Deve essere un numero maggiore di zero.</small>
            </div>
            <div class="field">
              <label>Descrizione</label>
              <textarea rows="3" v-model="descrizioneManuale" placeholder="Es. Consulenza informatica mese di..." style="resize:vertical;font-family:inherit"></textarea>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h2>Calcolo compenso</h2></div>
          <div class="card-body">
            <table class="data-table">
              <tr v-if="!modoManuale"><td>Ore totali mensili</td><td style="text-align:right">{{ (fatturaGenerata?.oreTotali ?? anteprima.totaleOre).toFixed(2) }}</td></tr>
              <tr v-if="!modoManuale"><td>Tariffa oraria</td><td style="text-align:right">€ {{ (fatturaGenerata?.tariffaOraria ?? clienteCorrente.tariffaOraria).toFixed(2) }}</td></tr>
              <tr><td>Imponibile</td><td style="text-align:right">€ {{ anteprimaEffettiva.imponibile.toFixed(2) }}</td></tr>
              <tr><td>Rivalsa INPS</td><td style="text-align:right">assente</td></tr>
              <tr v-if="anteprimaEffettiva.bolloApplicabile"><td>Bollo virtuale (&gt; {{ config.fatturazione.sogliaBolloVirtuale }}€)</td><td style="text-align:right">€ {{ anteprimaEffettiva.bollo.toFixed(2) }}</td></tr>
            </table>
            <div class="stat accent" style="margin-top:14px">
              <div class="label">Netto da pagare</div>
              <div class="value">€ {{ anteprimaEffettiva.nettoAPagare.toFixed(2) }}</div>
            </div>
          </div>
        </div>

        <div class="note-legal">
          Operazione ex art.1 commi 54–89 L.190/2014 (regime forfettario).
          <span v-if="anteprimaEffettiva.bolloApplicabile">Imposta di bollo assolta in modalità virtuale ai sensi DM 17/06/2014.</span>
        </div>

        <div class="card">
          <div class="card-head"><h2>Fattura definitiva</h2></div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:10px">
            <div class="field">
              <label>Data fattura</label>
              <input type="date" v-model="dataFattura" :disabled="fatturaAccettataSdi" />
            </div>
            <div class="field" v-if="fatturaGenerata">
              <label>Scadenza pagamento</label>
              <input type="date" v-model="dataScadenzaPagamento" :disabled="salvandoScadenza" @change="salvaScadenzaPagamento" />
              <small class="note-legal">Termine commerciale, non fiscale: modificabile anche a fattura già emessa.</small>
            </div>
            <div class="field" v-if="fatturaGenerata?.dataPagamento">
              <label>Data incasso</label>
              <input type="date" :value="fatturaGenerata.dataPagamento" disabled />
            </div>
            <button class="btn btn-primary" :disabled="fatturaAccettataSdi || (modoManuale && (!importoValido || !descrizioneManuale))" @click="generaFattura">
              {{ fatturaGenerata ? 'Rigenera fattura' : 'Genera fattura' }} n. {{ fatturaGenerata?.numero ?? '' }}
            </button>
            <small v-if="fatturaAccettataSdi" class="note-legal">Fattura accettata dallo SDI: emessa e non più modificabile. Per correggere un errore, emetti una nota di variazione.</small>
            <button class="btn btn-ghost" :disabled="!fatturaGenerata" @click="scaricaXml">Scarica XML FatturaPA</button>
            <button class="btn btn-ghost" :disabled="!fatturaGenerata || !clienteCorrente.email || inviandoEmail" @click="inviaEmail">
              {{ inviandoEmail ? 'Preparo…' : 'Invia email al cliente' }}
            </button>
            <small v-if="fatturaGenerata && !clienteCorrente.email" class="note-legal">Configura l'email del cliente in Impostazioni per abilitare l'invio.</small>
            <span v-if="esitoEmail" class="badge-mono">{{ esitoEmail }}</span>
            <button class="btn" :class="ultimoScarto ? 'btn-warn' : 'btn-ok'" :disabled="!fatturaGenerata || inviandoPec" @click="inviaPec">
              {{ inviandoPec ? 'Invio…' : (ultimoScarto ? 'Fattura scartata: reinvia a SDI' : 'Invia PEC a SDI') }}
            </button>
            <span v-if="esitoPec" class="badge-mono">{{ esitoPec }}</span>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h2>Ricevute SDI</h2></div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:10px">
            <p class="note-legal" v-if="config.sdi.pollingAbilitato">
              Controllo automatico periodico attivo in background. Usa questo bottone per un controllo immediato:
              scarica ricevute/notifiche/fattura firmata nella cartella archivio configurata in Impostazioni.
            </p>
            <p class="note-legal" v-else>
              Controllo ricevute SDI disattivato in Impostazioni &gt; PEC.
            </p>
            <button class="btn btn-ghost" :disabled="controllandoSdi || !config.sdi.pollingAbilitato" @click="controllaSdi">
              {{ controllandoSdi ? 'Controllo…' : 'Controlla ora' }}
            </button>
            <span v-if="esitoSdi" class="badge-mono">{{ esitoSdi }}</span>

            <ul v-if="fatturaGenerata && ricevuteSdi.length" style="list-style:none;padding:0;margin:8px 0 0;display:flex;flex-direction:column;gap:6px">
              <li v-for="r in ricevuteSdi" :key="r.nomeFile" style="display:flex;flex-direction:column;gap:4px;font-size:13px">
                <div style="display:flex;justify-content:space-between;gap:8px">
                  <span>{{ r.descrizione }}</span>
                  <span class="badge-mono">{{ new Date(r.data).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }}</span>
                </div>
                <div v-for="(e, i) in r.errori" :key="i" style="background:var(--warn-bg);border:1px solid var(--warn);border-radius:6px;padding:6px 8px;font-size:12px;display:flex;flex-direction:column;gap:4px;color:var(--ink)">
                  <span><strong>{{ e.codice }}</strong> — {{ e.descrizione }}</span>
                  <span v-if="e.dettaglio" style="opacity:.85">{{ e.dettaglio }}</span>
                  <span v-else-if="e.suggerimento" style="opacity:.75">{{ e.suggerimento }}</span>
                </div>
              </li>
            </ul>
            <p v-else class="note-legal" style="opacity:.5">
              {{ fatturaGenerata ? 'Nessuna ricevuta SDI archiviata per questa fattura.' : 'Genera prima la fattura per vedere la cronologia ricevute.' }}
            </p>
          </div>
        </div>
      </div>

      <div style="min-width:0">
        <TemplateStampa v-if="datiFattura" ref="anteprimaRef" :template-id="templateIdFattura" :dati="datiFattura" />
      </div>
    </div>
  </div>
</template>
