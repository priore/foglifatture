<script setup>
// Cronologia PEC: invii SDI effettuati (da tutte le fatture) + ricevute/notifiche
// SDI archiviate su disco (da tutte le fatture), sotto-voce "Impostazioni > PEC > Cronologia".
import { ref, onMounted } from 'vue';
import { api } from '../services/api.js';

const invii = ref([]);
const ricevute = ref([]);
const caricamento = ref(true);

onMounted(async () => {
  const dati = await api.cronologiaPec();
  invii.value = dati.invii;
  ricevute.value = dati.ricevute;
  caricamento.value = false;
});

function formatta(data) {
  return new Date(data).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
</script>

<template>
  <div>
    <div class="page-head">
      <div><h1>Cronologia PEC</h1><p>Invii SDI effettuati e ricevute/notifiche ricevute, su tutte le fatture</p></div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-head"><h2>Invii SDI</h2></div>
      <div class="card-body">
        <p v-if="caricamento" class="note-legal">Caricamento…</p>
        <ul v-else-if="invii.length" style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px">
          <li v-for="i in invii" :key="`${i.clienteId}-${i.progressivoInvio}`" style="display:flex;justify-content:space-between;gap:8px;font-size:13px">
            <span>Fattura {{ i.mese }}/{{ i.anno }} — progressivo {{ i.progressivoInvio }} — {{ i.esito }}{{ i.errore ? `: ${i.errore}` : '' }}</span>
            <span class="badge-mono">{{ formatta(i.dataInvio) }}</span>
          </li>
        </ul>
        <p v-else class="note-legal" style="opacity:.5">Nessun invio PEC effettuato.</p>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h2>Ricevute e notifiche SDI</h2></div>
      <div class="card-body">
        <p v-if="caricamento" class="note-legal">Caricamento…</p>
        <ul v-else-if="ricevute.length" style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px">
          <li v-for="r in ricevute" :key="r.nomeFile" style="display:flex;flex-direction:column;gap:4px;font-size:13px">
            <div style="display:flex;justify-content:space-between;gap:8px">
              <span>{{ r.descrizione }} — {{ r.nomeFile }}</span>
              <span class="badge-mono">{{ formatta(r.data) }}</span>
            </div>
            <div v-for="(e, i) in r.errori" :key="i" style="background:var(--warn-bg);border:1px solid var(--warn);border-radius:6px;padding:6px 8px;font-size:12px;display:flex;flex-direction:column;gap:4px;color:var(--ink)">
              <span><strong>{{ e.codice }}</strong> — {{ e.descrizione }}</span>
              <span v-if="e.dettaglio" style="opacity:.85">{{ e.dettaglio }}</span>
              <span v-else-if="e.suggerimento" style="opacity:.75">{{ e.suggerimento }}</span>
            </div>
          </li>
        </ul>
        <p v-else class="note-legal" style="opacity:.5">Nessuna ricevuta SDI archiviata. Configura la cartella archivio in Impostazioni &gt; PEC.</p>
      </div>
    </div>
  </div>
</template>
