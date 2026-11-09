<script setup>
import { chiediConferma, chiediScelta } from '../composables/useConferma.js';
import SelectField from './common/SelectField.vue';
import DateField from './common/DateField.vue';
import ModuloPopup from './common/ModuloPopup.vue';
import ListaPopup from './common/ListaPopup.vue';
// Registro BTC (FP-012): movimenti in ingresso (rate fattura + manuali)
// e uscite, saldo residuo LIFO, form di registrazione con anteprima plusvalenza. Vive nella tab Bitcoin.
import { ref, computed, watch, onMounted } from 'vue';
import { api } from '../services/api.js';

const props = defineProps({ anno: { type: Number, required: true } });
const emit = defineEmits(['cambiato']);

const SAT = 1e8;
const lotti = ref([]);
const uscite = ref([]);
const cessioni = ref([]);
const errore = ref('');
const avvisi = ref([]);
const caricando = ref(false);
const regoleProvvisorie = ref(false);

const formAperto = ref(null); // 'uscita' | 'ingresso' | 'giacenza' | null
const salvando = ref(false);
const anteprima = ref(null);
const vuoto = () => ({ tipo: '', data: '', btc: '', euro: '', cambio: '', txid: '', custodia: '', note: '' });
const form = ref(vuoto());

const eur = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n ?? 0);
// Wallet impostati in Impostazioni (config.walletBtc): scelta rapida per il campo wallet, che resta libero.
const walletImpostati = ref([]);
const sceltaWalletAperta = ref(false);
const vociWallet = computed(() => walletImpostati.value.map((w) => ({ value: w.etichetta || w.indirizzo, label: w.etichetta ? `${w.etichetta} · ${w.indirizzo}` : w.indirizzo })));
const TIPI = { 'saldo-iniziale': 'giacenza dichiarata' };
const chiaveWallet = (c) => (c ?? '').trim().toLowerCase();
const ORIGINI = { fattura: 'Fattura', manuale: 'Manuale', 'import-file': 'Import file', 'import-polling': 'Import automatico' };
const dataIt = (iso) => iso.split('-').reverse().join('/');
const btcTesto = (sat) => (sat / SAT).toFixed(8);
const satDaBtc = (btc) => Math.round(Number(String(btc).replace(',', '.')) * SAT);
const numero = (v) => Number(String(v).replace(',', '.'));

async function carica() {
  caricando.value = true;
  errore.value = '';
  try {
    const [l, m, p] = await Promise.all([api.lottiBtc(props.anno), api.movimentiBtc(), api.plusvalenzeBtc(props.anno)]);
    lotti.value = l;
    uscite.value = m.uscite;
    cessioni.value = p.cessioni;
    regoleProvvisorie.value = !!(await api.regoleFiscaliAnno(props.anno).catch(() => null))?.provvisorie;
  } catch (err) {
    errore.value = err.message;
  } finally {
    caricando.value = false;
  }
}
onMounted(() => {
  carica();
  api.getConfig().then((c) => { walletImpostati.value = (c.walletBtc ?? []).filter((w) => w.etichetta || w.indirizzo); }).catch(() => {});
});
watch(() => props.anno, carica);

// Righe dell'anno selezionato: lotti con data nell'anno + uscite dell'anno, per data.
const righe = computed(() => {
  const a = String(props.anno);
  const plus = new Map(cessioni.value.map((c) => [c.uscita.id, c.plusvalenza]));
  const ingressi = lotti.value.filter((l) => l.data.startsWith(a)).map((l) => ({
    id: l.id, data: l.data, direzione: 'in', tipo: TIPI[l.tipo] ?? l.tipo, fonte: l.fonte, satoshi: l.satoshi, euro: l.costoEur, txid: l.txid,
    nota: l.costoNonDocumentato ? 'costo non documentato' : l.stato === 'consumato' ? 'consumato' : l.stato === 'parziale' ? `residuo ${btcTesto(l.residui)}` : '',
    eliminabile: l.fonte === 'manuale',
  }));
  const out = uscite.value.filter((u) => u.data.startsWith(a)).map((u) => ({
    id: u.id, data: u.data, direzione: 'out', tipo: u.tipo, fonte: u.fonte, satoshi: u.satoshi, euro: u.ricavoEur, txid: u.txid,
    plusvalenza: plus.get(u.id), eliminabile: true,
  }));
  return [...ingressi, ...out].sort((x, y) => x.data.localeCompare(y.data));
});

const saldo = computed(() => lotti.value.reduce((t, l) => t + l.residui, 0));
const costoResiduo = computed(() => lotti.value.reduce((t, l) => t + (l.costoEur * l.residui) / l.satoshi, 0));

function apri(tipo) {
  formAperto.value = formAperto.value === tipo ? null : tipo;
  form.value = vuoto();
  form.value.tipo = tipo === 'uscita' ? 'vendita' : tipo === 'giacenza' ? 'saldo-iniziale' : 'acquisto';
  anteprima.value = null;
  avvisi.value = [];
}

// Euro mancante ma cambio e BTC presenti: euro = BTC × cambio (resta modificabile).
function euroDaCambio() {
  if (form.value.euro === '' && form.value.cambio !== '' && form.value.btc !== '') {
    form.value.euro = (numero(form.value.btc) * numero(form.value.cambio)).toFixed(2);
  }
}

function payload() {
  const f = form.value;
  const base = { tipo: f.tipo, data: f.data || (formAperto.value === 'giacenza' ? `${props.anno}-01-01` : ''), satoshi: satDaBtc(f.btc) };
  if (f.txid) base.txid = f.txid.trim();
  if (f.custodia) base.custodia = f.custodia.trim();
  if (f.note) base.note = f.note.trim();
  if (formAperto.value === 'giacenza') return { ...base, ...(f.euro !== '' ? { costoEur: numero(f.euro) } : {}) };
  if (formAperto.value === 'ingresso') return { ...base, costoEur: numero(f.euro || 0) };
  if (f.cambio !== '') base.cambioEurBtc = numero(f.cambio);
  return { ...base, ricavoEur: f.tipo === 'trasferimento' ? 0 : numero(f.euro || 0) };
}

// Anteprima plusvalenza solo per vendita/spesa con dati completi (nessun salvataggio).
let timer = null;
watch(() => ({ ...form.value }), () => {
  clearTimeout(timer);
  anteprima.value = null;
  const f = form.value;
  if (formAperto.value !== 'uscita' || f.tipo === 'trasferimento' || !f.data || !f.btc || !f.euro) return;
  timer = setTimeout(async () => {
    try {
      anteprima.value = await api.anteprimaUscitaBtc(payload());
    } catch (err) {
      anteprima.value = { errore: err.message };
    }
  }, 400);
}, { deep: true });

async function salva() {
  salvando.value = true;
  errore.value = '';
  try {
    const dati = payload();
    let r;
    if (formAperto.value === 'giacenza') {
      const presente = lotti.value.some((l) => l.tipo === 'saldo-iniziale' && chiaveWallet(l.custodia) === chiaveWallet(dati.custodia));
      if (presente) {
        const scelta = await chiediScelta(
          `Per ${dati.custodia ? `il wallet «${dati.custodia}»` : 'il wallet non specificato'} è già dichiarata una giacenza. Sommare la nuova quantità a quella esistente o sostituirla?`,
          { titolo: 'Giacenza già dichiarata', ok: 'Somma', alternativa: 'Sovrascrivi' },
        );
        if (!scelta) return;
        dati.modalita = scelta === 'ok' ? 'somma' : 'sovrascrivi';
      }
      r = await api.dichiaraGiacenzaBtc(dati);
    } else {
      r = formAperto.value === 'uscita' ? await api.aggiungiUscitaBtc(dati) : await api.aggiungiIngressoBtc(dati);
    }
    avvisi.value = r.avvisi;
    formAperto.value = null;
    await carica();
    emit('cambiato');
  } catch (err) {
    errore.value = err.message;
  } finally {
    salvando.value = false;
  }
}

async function elimina(r) {
  if (!(await chiediConferma(`Eliminare il movimento del ${dataIt(r.data)} (${btcTesto(r.satoshi)} BTC)? Plusvalenze e saldo verranno ricalcolati.`, { titolo: 'Elimina movimento', ok: 'Elimina' }))) return;
  try {
    avvisi.value = (await api.eliminaMovimentoBtc(r.id)).avvisi;
    await carica();
    emit('cambiato');
  } catch (err) {
    errore.value = err.message;
  }
}
</script>

<template>
  <div class="registro-btc">
    <div class="mini-stat-row">
      <div class="mini-stat"><span class="mini-stat-label">Saldo al 31/12/{{ anno }}</span><span class="mini-stat-value">{{ btcTesto(saldo) }} BTC</span></div>
      <div class="mini-stat" title="Costo di carico LIFO dei BTC ancora detenuti"><span class="mini-stat-label">Costo di carico</span><span class="mini-stat-value">{{ eur(costoResiduo) }}</span></div>
    </div>

    <p class="note-legal">
      Plusvalenze calcolate con metodo LIFO sulle regole {{ anno }}: stima da verificare con il commercialista.
      <span v-if="regoleProvvisorie" class="badge-fonte" style="color:var(--warn)" title="Regole non confermate o non verificate di recente">provvisorio</span>
    </p>

    <p v-if="errore" class="avviso-riga avviso-warn" role="alert">{{ errore }}</p>
    <p v-for="a in avvisi" :key="a" class="avviso-riga avviso-info">{{ a }}</p>

    <div class="azioni">
      <button type="button" :class="formAperto === 'uscita' ? 'btn btn-primary' : 'btn btn-ok'" @click="apri('uscita')">Registra uscita</button>
      <button type="button" :class="formAperto === 'ingresso' ? 'btn btn-primary' : 'btn btn-ok'" @click="apri('ingresso')">Aggiungi ingresso manuale</button>
      <button type="button" :class="formAperto === 'giacenza' ? 'btn btn-primary' : 'btn btn-ok'" title="Quantità posseduta senza storico dei movimenti" @click="apri('giacenza')">Dichiara giacenza</button>
    </div>

    <ModuloPopup v-if="formAperto" come-form :titolo="{ uscita: 'Registra uscita', ingresso: 'Aggiungi ingresso manuale', giacenza: 'Dichiara giacenza' }[formAperto]" @invia="salva" @chiudi="formAperto = null">
      <p class="note-legal">
        <template v-if="formAperto === 'uscita'">Vendita o spesa in BTC sono cessioni tassabili; il trasferimento tra wallet propri no.</template>
        <template v-else-if="formAperto === 'giacenza'">Quantità BTC posseduta in un wallet, senza storico. Una giacenza per wallet (senza nome vale come wallet non specificato); entra nel saldo e nel quadro RW. Senza data si usa il 1° gennaio dell'anno selezionato: da cambiare se i BTC sono stati ottenuti dopo, perché la data conta nei giorni di detenzione dell'IVCA. Senza costo di acquisto la plusvalenza di una futura vendita risulta pari all'intero ricavo.</template>
        <template v-else>Per BTC non incassati da fattura (acquisti, regali, mining), con il costo di acquisto.</template>
      </p>
      <div class="form-grid">
        <div class="field" v-if="formAperto !== 'giacenza'">
          <label for="reg-tipo">Tipo</label>
          <SelectField titolo="Tipo operazione" descrizione="Natura dell'operazione BTC" id="reg-tipo" v-model="form.tipo" required>
            <template v-if="formAperto === 'uscita'">
              <option value="vendita">Vendita</option><option value="spesa">Spesa</option><option value="trasferimento">Trasferimento</option>
            </template>
            <template v-else>
              <option value="acquisto">Acquisto</option><option value="ricevuto">Ricevuto</option><option value="mining">Mining</option>
            </template>
          </SelectField>
        </div>
        <div class="field">
          <label for="reg-data">{{ formAperto === 'giacenza' ? `Data giacenza (opzionale, predefinita 01/01/${anno})` : 'Data' }}</label>
          <DateField v-model="form.data" :titolo="formAperto === 'giacenza' ? 'Data della giacenza' : 'Data operazione'" :descrizione="formAperto === 'giacenza' ? 'Giorno a cui si riferisce la quantità posseduta' : 'Giorno in cui è avvenuta l\'operazione BTC'" :required="formAperto !== 'giacenza'" />
        </div>
        <div class="field">
          <label for="reg-btc">Quantità (BTC)</label>
          <input id="reg-btc" v-model="form.btc" type="text" inputmode="decimal" placeholder="0,00500000" required @blur="euroDaCambio">
        </div>
        <div class="field" v-if="form.tipo !== 'trasferimento'">
          <label for="reg-euro">{{ formAperto === 'uscita' ? 'Ricavo (EUR)' : formAperto === 'giacenza' ? 'Costo (EUR, opzionale)' : 'Costo (EUR)' }}</label>
          <input id="reg-euro" v-model="form.euro" type="text" inputmode="decimal" placeholder="0,00" :required="formAperto !== 'giacenza'">
        </div>
        <div class="field" v-if="formAperto === 'uscita' && form.tipo !== 'trasferimento'">
          <label for="reg-cambio">Cambio EUR/BTC (opzionale)</label>
          <input id="reg-cambio" v-model="form.cambio" type="text" inputmode="decimal" @blur="euroDaCambio">
        </div>
        <div class="field">
          <label for="reg-custodia">Wallet / exchange (opzionale)</label>
          <div class="riga-wallet">
            <input id="reg-custodia" v-model="form.custodia" type="text" placeholder="Scrivi o incolla il nome">
            <button type="button" class="btn-icona-campo" :disabled="!vociWallet.length" :aria-label="vociWallet.length ? 'Scegli tra i wallet impostati' : 'Nessun wallet impostato'" :title="vociWallet.length ? 'Scegli tra i wallet impostati' : 'Nessun wallet impostato: aggiungili in Impostazioni › Fornitore'" @click="sceltaWalletAperta = true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5" /><path d="M16 13.5h.01" /></svg>
            </button>
          </div>
          <ListaPopup v-if="sceltaWalletAperta" :voci="vociWallet" :model-value="form.custodia" :titolo="'Seleziona wallet'" :descrizione="formAperto === 'giacenza' ? 'Wallet a cui appartiene la giacenza, tra quelli impostati in Impostazioni › Fornitore' : 'Wallet o exchange del movimento, tra quelli impostati in Impostazioni › Fornitore'" @conferma="(v) => { form.custodia = v; sceltaWalletAperta = false; }" @chiudi="sceltaWalletAperta = false" />
        </div>
        <div class="field full" v-if="formAperto !== 'giacenza'">
          <label for="reg-txid">TXID (opzionale)</label>
          <input id="reg-txid" v-model="form.txid" type="text" maxlength="64" pattern="[0-9a-fA-F]{64}" title="64 caratteri esadecimali">
        </div>
        <div class="field full">
          <label for="reg-note">Note (opzionale)</label>
          <input id="reg-note" v-model="form.note" type="text">
        </div>
      </div>

      <div v-if="anteprima" class="anteprima">
        <p v-if="anteprima.errore" class="avviso-riga avviso-warn">{{ anteprima.errore }}</p>
        <template v-else-if="anteprima.cessione">
          <div class="mini-stat-row">
            <div class="mini-stat"><span class="mini-stat-label">Costo LIFO</span><span class="mini-stat-value">{{ eur(anteprima.cessione.costoEur) }}</span></div>
            <div class="mini-stat">
              <span class="mini-stat-label">{{ anteprima.cessione.plusvalenza >= 0 ? 'Plusvalenza' : 'Minusvalenza' }}</span>
              <span class="mini-stat-value" :class="anteprima.cessione.plusvalenza >= 0 ? 'pos' : 'neg'">{{ eur(anteprima.cessione.plusvalenza) }}</span>
            </div>
          </div>
          <p v-for="a in anteprima.avvisi" :key="a" class="avviso-riga avviso-warn">{{ a }}</p>
        </template>
      </div>

      <template #azioni>
        <button type="submit" class="btn btn-ok" :disabled="salvando">{{ salvando ? 'Salvataggio…' : 'Salva' }}</button>
        <button type="button" class="btn btn-warn" @click="formAperto = null">Annulla</button>
      </template>
    </ModuloPopup>

    <p v-if="caricando && !righe.length" class="note-legal">Caricamento…</p>
    <p v-else-if="!righe.length" class="note-legal">Nessun movimento BTC nel {{ anno }}.</p>
    <div v-else class="tabella-scroll">
      <table class="data-table tabella-registro">
        <thead>
          <tr><th>Data</th><th>Movimento</th><th>Tipo</th><th>BTC</th><th>EUR</th><th>Esito</th><th><span class="sr-only">Azioni</span></th></tr>
        </thead>
        <tbody>
          <tr v-for="r in righe" :key="r.id">
            <td>{{ dataIt(r.data) }}</td>
            <td>{{ r.direzione === 'in' ? 'Ingresso' : 'Uscita' }} · {{ r.tipo }}</td>
            <td :title="r.fonte === 'fattura' ? 'Rata di fattura: si elimina dalla pagina fattura' : null">{{ ORIGINI[r.fonte] ?? r.fonte }}</td>
            <td>{{ r.direzione === 'in' ? '+' : '−' }}{{ btcTesto(r.satoshi) }}</td>
            <td>{{ eur(r.euro) }}</td>
            <td>
              <span v-if="r.plusvalenza != null" :class="r.plusvalenza >= 0 ? 'pos' : 'neg'">{{ r.plusvalenza >= 0 ? 'Plus.' : 'Minus.' }} {{ eur(r.plusvalenza) }}</span>
              <span v-else class="nota">{{ r.nota }}</span>
            </td>
            <td>
              <button v-if="r.eliminabile" type="button" class="btn-elimina" aria-label="Elimina movimento" title="Elimina" @click="elimina(r)">✕</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.mini-stat-row { display: flex; gap: 12px; flex-wrap: wrap; }
.mini-stat { flex: 1; min-width: 140px; background: var(--ground); border: 1px solid var(--line); border-radius: var(--radius-md); padding: 8px 12px; display: flex; flex-direction: column; gap: 2px; }
.mini-stat-label { font-size: var(--font-size-2xs); color: var(--muted); text-transform: uppercase; letter-spacing: .03em; }
.mini-stat-value { font-size: var(--font-size-md); font-weight: 700; color: var(--ink); }
.avviso-riga { margin-top: 8px; font-size: var(--font-size-xs); padding: 6px 10px; border-radius: var(--radius-sm); }
.avviso-warn { background: var(--warn-bg); color: var(--warn); font-weight: 600; }
.avviso-info { background: var(--ground); border: 1px solid var(--line); color: var(--ink-soft); }
.azioni { display: flex; gap: var(--gap-sm); flex-wrap: wrap; margin: 14px 0; }
.anteprima { margin-top: 14px; }
.tabella-registro th:nth-child(n+4):nth-child(-n+6), .tabella-registro td:nth-child(n+4):nth-child(-n+6) { text-align: center; }
.tabella-scroll { position: relative; overflow-x: auto; max-height: 320px; overflow-y: auto; }
.pos { color: var(--ok); }
.neg { color: var(--warn); }
.nota { font-size: var(--font-size-xs); color: var(--muted); }
.btn-elimina { background: none; border: none; cursor: pointer; color: var(--muted); font-size: var(--font-size-md); padding: 2px 6px; }
.btn-elimina:hover, .btn-elimina:focus-visible { color: var(--warn); }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
@media (max-width: 640px) { .form-grid { grid-template-columns: 1fr; } }
</style>
