<script setup>
// Import BTC (FP-014, piano REGISTRO_LOTTI_BTC.md Step 12): proposte da polling blockchain e da file,
// da confermare (con il controvalore EUR) o scartare. Stato del polling e import da file. Tab Bitcoin.
import { ref, computed, onMounted } from 'vue';
import { api } from '../services/api.js';
import FileDrop from './common/FileDrop.vue';

const emit = defineEmits(['cambiato']);

const SAT = 1e8;
const dati = ref(null);
const errore = ref('');
const info = ref('');
const occupato = ref(false);
const apertaId = ref(null); // proposta con il form di conferma aperto
const conf = ref({ euro: '', tipo: '' });

const eur = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n ?? 0);
const dataIt = (iso) => iso.split('-').reverse().join('/');
const dataOra = (iso) => new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
const btcTesto = (sat) => (sat / SAT).toFixed(8);
const numero = (v) => Number(String(v).replace(',', '.'));
const host = (url) => { try { return new URL(url).host; } catch { return url; } };

const inAttesa = computed(() => (dati.value?.proposte ?? []).filter((p) => p.stato === 'proposta'));
const scartate = computed(() => (dati.value?.proposte ?? []).filter((p) => p.stato === 'scartata'));
const imp = computed(() => dati.value?.impostazioni ?? {});
const attivo = computed(() => imp.value.abilitato && imp.value.avvisoPrivacyAccettato && imp.value.walletConfigurati);
const prossimo = computed(() => {
  const u = dati.value?.ultimoControllo;
  return attivo.value && u ? dataOra(new Date(Date.parse(u) + imp.value.intervalloMinuti * 60_000).toISOString()) : null;
});
// Perché il controllo manuale non è disponibile (mostrato al posto di nascondere il pulsante).
const motivoControllo = computed(() => {
  if (!imp.value.walletConfigurati) return 'Configura almeno un indirizzo wallet';
  if (!imp.value.avvisoPrivacyAccettato) return 'Accetta l\'avviso privacy';
  return '';
});

async function carica() {
  try {
    dati.value = await api.proposteImportBtc();
  } catch (err) {
    errore.value = err.message;
  }
}
onMounted(carica);

async function esegui(fn) {
  occupato.value = true;
  errore.value = '';
  info.value = '';
  try {
    await fn();
  } catch (err) {
    errore.value = err.message;
  } finally {
    occupato.value = false;
  }
}

const controlla = () => esegui(async () => {
  const r = await api.controllaImportBtc();
  info.value = r.nuove.length ? `${r.nuove.length} nuove transazioni da confermare.` : 'Nessuna nuova transazione.';
  if (r.discordanti.length) errore.value = `${r.discordanti.length} transazioni con dati discordanti tra i provider: non proposte.`;
  await carica();
});

function apriConferma(p) {
  apertaId.value = apertaId.value === p.id ? null : p.id;
  conf.value = { euro: p.valoreEur != null ? String(p.valoreEur).replace('.', ',') : '', tipo: p.tipoSuggerito ?? (p.direzione === 'ingresso' ? 'ricevuto' : 'vendita') };
}

const conferma = (p) => esegui(async () => {
  const d = { tipo: conf.value.tipo };
  if (conf.value.tipo !== 'trasferimento') d[p.direzione === 'ingresso' ? 'costoEur' : 'ricavoEur'] = numero(conf.value.euro || 0);
  const r = await api.azioneProposta(p.id, 'conferma', d);
  info.value = (r.avvisi ?? []).join(' ') || 'Registrato.';
  apertaId.value = null;
  await carica();
  emit('cambiato');
});

const azione = (p, nome) => esegui(async () => {
  await api.azioneProposta(p.id, nome);
  await carica();
});

// ── Import da file ──
const file = ref(null);
const formato = ref('auto');
const mappingDaConfermare = ref(null); // { intestazioni, mapping }

function sceltaFile(files) {
  file.value = files[0] ?? null;
  mappingDaConfermare.value = null;
}

const importaFile = (opzioni = {}) => esegui(async () => {
  if (!file.value) return;
  const r = await api.importaFileBtc(file.value, { formato: formato.value, ...opzioni }).catch(async (err) => {
    // Formato sconosciuto: l'analisi AI invia dati fiscali (hash per indirizzi/txid) solo con consenso esplicito.
    if (err.codice === 'AUTORIZZAZIONE_RICHIESTA' && confirm('Formato non riconosciuto: l\'AI analizzerà alcune righe per proporre le colonne. Indirizzi e TXID sono sostituiti da hash, ma date e importi vengono inviati al provider AI. Procedere?')) {
      return api.importaFileBtc(file.value, { formato: formato.value, ...opzioni, conferma: true });
    }
    throw err;
  });
  if (r.richiedeMapping) {
    mappingDaConfermare.value = { intestazioni: r.intestazioni, mapping: { ...r.mappingProposto } };
    return;
  }
  mappingDaConfermare.value = null;
  file.value = null;
  file.value = null;
  info.value = `Importato: ${r.nuove} nuove proposte, ${r.duplicate} già note${r.scartate ? `, ${r.scartate} righe non valide` : ''}${r.ignorate ? `, ${r.ignorate} depositi/prelievi ignorati` : ''}.`;
  await carica();
});

const confermaMapping = () => importaFile({ mapping: mappingDaConfermare.value.mapping });
</script>

<template>
  <div class="import-btc">
    <div class="stato-polling">
      <span class="badge-mono">{{ attivo ? 'Controllo automatico attivo' : 'Controllo automatico non attivo' }}</span>
      <span v-if="dati?.ultimoControllo" class="nota">Ultimo controllo {{ dataOra(dati.ultimoControllo) }}</span>
      <span v-if="prossimo" class="nota">Prossimo {{ prossimo }}</span>
      <router-link v-if="!attivo" to="/impostazioni" class="nota">Attivalo in Impostazioni → Fornitore → Wallet Bitcoin</router-link>
    </div>
    <p v-if="dati?.ultimoErrore" class="avviso-riga avviso-warn" role="alert">Ultimo controllo fallito: {{ dati.ultimoErrore }}</p>
    <p v-if="errore" class="avviso-riga avviso-warn" role="alert">{{ errore }}</p>
    <p v-if="info" class="avviso-riga avviso-info" role="status">{{ info }}</p>

    <div class="azioni">
      <button type="button" class="btn btn-ghost" :disabled="occupato || !!motivoControllo" :title="motivoControllo" @click="controlla">Controlla ora</button>
      <div class="field campo-provider">
        <label for="import-formato">Provider / exchange</label>
        <select id="import-formato" v-model="formato" :disabled="occupato">
          <option value="auto">Riconoscimento automatico</option>
          <optgroup label="Wallet">
            <option value="sparrow">Sparrow (CSV)</option>
            <option value="electrum">Electrum (CSV)</option>
            <option value="json">JSON (Electrum)</option>
          </optgroup>
          <optgroup label="Exchange">
            <option value="kraken">Kraken (ledger CSV)</option>
            <option value="binance">Binance (report fiscale CSV)</option>
            <option value="coinbase">Coinbase (CSV)</option>
            <option value="onetrading">One Trading (CSV)</option>
          </optgroup>
        </select>
      </div>
      <FileDrop class="drop-import" accept=".csv,.json,text/csv,application/json" :disabled="occupato"
        :label="file ? file.name : 'Trascina qui il file o clicca per sfogliare'" @change="sceltaFile" />
      <button type="button" class="btn btn-primary" :disabled="occupato || !file" @click="importaFile()">Importa</button>
    </div>
    <p v-if="motivoControllo" class="note-legal">«Controlla ora» non disponibile: {{ motivoControllo.toLowerCase() }}. L'import da file funziona comunque.</p>

    <div v-if="mappingDaConfermare" class="mapping">
      <p class="note-legal">Formato non riconosciuto: l'AI propone queste colonne. Verifica e conferma.</p>
      <div class="form-grid">
        <div v-for="[chiave, etichetta, obbligatoria] in [['colonnaData', 'Data', true], ['colonnaImporto', 'Importo BTC', true], ['colonnaTxid', 'TXID', false], ['colonnaEur', 'Controvalore EUR', false], ['colonnaTipo', 'Tipo (entrata/uscita)', false]]" :key="chiave" class="field">
          <label :for="`map-${chiave}`">{{ etichetta }}</label>
          <select :id="`map-${chiave}`" v-model="mappingDaConfermare.mapping[chiave]">
            <option v-if="!obbligatoria" :value="null">— nessuna —</option>
            <option v-for="(h, i) in mappingDaConfermare.intestazioni" :key="i" :value="i">{{ h }}</option>
          </select>
        </div>
        <div class="field">
          <label for="map-unita">Unità importo</label>
          <select id="map-unita" v-model="mappingDaConfermare.mapping.unita"><option value="btc">BTC</option><option value="satoshi">Satoshi</option></select>
        </div>
      </div>
      <div class="azioni">
        <button type="button" class="btn btn-primary" :disabled="occupato" @click="confermaMapping">Conferma mapping e importa</button>
        <button type="button" class="btn btn-ghost" @click="mappingDaConfermare = null">Annulla</button>
      </div>
    </div>

    <p v-if="!dati" class="note-legal">Caricamento…</p>
    <p v-else-if="!inAttesa.length" class="note-legal">Nessuna transazione da confermare.</p>
    <ul v-else class="proposte">
      <li v-for="p in inAttesa" :key="p.id">
        <div class="riga">
          <div class="dettaglio">
            <strong>{{ p.direzione === 'ingresso' ? '+' : '−' }}{{ btcTesto(p.satoshi) }} BTC</strong>
            <span class="nota">{{ p.data ? dataIt(p.data) : 'in attesa di conferme' }} · {{ p.direzione }}</span>
            <span class="nota">
              {{ p.fonte === 'import-file' ? 'da file' : `blockchain (${(p.providers ?? []).map(host).join(', ')}) · ${p.conferme} conferme` }}
              <template v-if="p.valoreEur != null"> · {{ eur(p.valoreEur) }}</template>
            </span>
          </div>
          <div class="azioni-riga">
            <button type="button" class="btn btn-ok" :disabled="occupato || !p.data" :title="p.data ? '' : 'Transazione non ancora confermata'" @click="apriConferma(p)">Conferma…</button>
            <button type="button" class="btn btn-ghost" :disabled="occupato" @click="azione(p, 'scarta')">Scarta</button>
          </div>
        </div>
        <p v-for="a in p.avvisi" :key="a" class="avviso-riga avviso-warn">{{ a }}</p>
        <form v-if="apertaId === p.id" class="form-conferma" @submit.prevent="conferma(p)">
          <div class="form-grid">
            <div class="field">
              <label :for="`c-tipo-${p.id}`">Tipo</label>
              <select :id="`c-tipo-${p.id}`" v-model="conf.tipo">
                <template v-if="p.direzione === 'ingresso'"><option value="ricevuto">Ricevuto</option><option value="acquisto">Acquisto</option><option value="mining">Mining</option></template>
                <template v-else><option value="vendita">Vendita</option><option value="spesa">Spesa</option><option value="trasferimento">Trasferimento tra wallet propri</option></template>
              </select>
            </div>
            <div v-if="conf.tipo !== 'trasferimento'" class="field">
              <label :for="`c-eur-${p.id}`">{{ p.direzione === 'ingresso' ? 'Costo (EUR)' : 'Ricavo (EUR)' }}</label>
              <input :id="`c-eur-${p.id}`" v-model="conf.euro" type="text" inputmode="decimal" placeholder="0,00" required>
            </div>
          </div>
          <div class="azioni">
            <button type="submit" class="btn btn-primary" :disabled="occupato">Registra</button>
            <button type="button" class="btn btn-ghost" @click="apertaId = null">Annulla</button>
          </div>
        </form>
      </li>
    </ul>

    <details v-if="scartate.length" class="scartate">
      <summary>Scartate ({{ scartate.length }})</summary>
      <ul class="proposte">
        <li v-for="p in scartate" :key="p.id" class="riga">
          <span class="dettaglio"><strong>{{ p.direzione === 'ingresso' ? '+' : '−' }}{{ btcTesto(p.satoshi) }} BTC</strong> <span class="nota">{{ p.data ? dataIt(p.data) : '' }}</span></span>
          <button type="button" class="btn btn-ghost" :disabled="occupato" @click="azione(p, 'ripristina')">Ripristina</button>
        </li>
      </ul>
    </details>
  </div>
</template>

<style scoped>
.stato-polling { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
.avviso-riga { margin-top: 8px; font-size: var(--font-size-xs); padding: 6px 10px; border-radius: var(--radius-sm); }
.avviso-warn { background: var(--warn-bg); color: var(--warn); font-weight: 600; }
.avviso-info { background: var(--ground); border: 1px solid var(--line); color: var(--ink-soft); }
.azioni { display: flex; gap: var(--gap-sm); flex-wrap: wrap; align-items: flex-end; margin: 14px 0; }
.campo-provider { min-width: 220px; }
.azioni .drop-import { flex: 1; min-width: 220px; padding: 9px 16px; }
.mapping, .form-conferma { border: 1px solid var(--line); border-radius: var(--radius-md); padding: 14px; margin: 8px 0; background: var(--ground); }
.proposte { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--gap-sm); }
.proposte > li { border: 1px solid var(--line); border-radius: var(--radius-md); padding: 10px 12px; }
.riga { display: flex; justify-content: space-between; gap: 12px; align-items: center; flex-wrap: wrap; }
.dettaglio { display: flex; flex-direction: column; gap: 2px; }
.azioni-riga { display: flex; gap: var(--gap-sm); }
.nota { font-size: var(--font-size-xs); color: var(--muted); }
.scartate { margin-top: 14px; }
.scartate summary { cursor: pointer; font-size: var(--font-size-sm); color: var(--ink-soft); margin-bottom: 8px; }
@media (max-width: 640px) { .mapping :deep(.form-grid), .form-conferma :deep(.form-grid) { grid-template-columns: 1fr; } }
</style>
