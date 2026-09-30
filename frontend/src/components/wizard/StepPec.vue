<script setup>
import { computed, ref, onMounted } from 'vue';
import { api } from '../../services/api.js';
import { pecValida } from '../../composables/useValidazioneFiscale.js';

const props = defineProps({
  modelValue: { type: Object, required: true }, // config.pec
  sdi: { type: Object, required: true }, // config.sdi
});

const casellaMittenteOk = computed(() => pecValida(props.modelValue.casellaMittente));

const gestori = ref([]);
const gestoreId = ref('');
const gestore = computed(() => gestori.value.find((g) => g.id === gestoreId.value));
onMounted(async () => { gestori.value = await api.gestoriPec().catch(() => []); });

// Precompila i server del gestore; i campi restano modificabili (TLS implicito).
function scegliGestore() {
  if (!gestore.value) return;
  const g = gestore.value;
  Object.assign(props.modelValue, {
    smtpHost: g.smtpHost, smtpPort: g.smtpPort, smtpSecure: true,
    imapHost: g.imapHost, imapPort: g.imapPort, imapSecure: true,
  });
}

const prova = ref(null);
const provaInCorso = ref(false);
async function provaConnessione() {
  provaInCorso.value = true;
  try { prova.value = await api.provaPec(); }
  catch (e) { prova.value = { ok: false, passi: [{ id: 'ERR', etichetta: 'Prova', ok: false, errore: e.message }] }; }
  finally { provaInCorso.value = false; }
}

const provaSdi = ref(null);
const risposteSdi = ref(null);
const provaSdiInCorso = ref(false);
async function inviaProvaSdi() {
  if (!confirm('Invio allo SDI una PEC vuota, senza fattura. Lo SDI risponde con un messaggio di cortesia. Procedere?')) return;
  provaSdiInCorso.value = true;
  risposteSdi.value = null;
  try { provaSdi.value = await api.provaPecSdi(); }
  catch (e) { provaSdi.value = { inviato: false, errore: e.message }; }
  finally { provaSdiInCorso.value = false; }
}
async function leggiRisposte() {
  try { risposteSdi.value = await api.risposteProvaPecSdi(provaSdi.value.inviataIl); }
  catch (e) { risposteSdi.value = { risposte: [], errore: e.message }; }
}
</script>

<template>
  <div class="card">
    <div class="card-head"><h2>Configurazione PEC</h2></div>
    <div class="card-body">
  <div class="form-grid">
    <div class="field field-full full">
      <label>Gestore PEC</label>
      <select v-model="gestoreId" @change="scegliGestore">
        <option value="">Altro gestore (inserimento manuale)</option>
        <option v-for="g in gestori" :key="g.id" :value="g.id">{{ g.nome }}</option>
      </select>
      <small v-if="gestore?.suggerimentoPassword" class="note-legal">{{ gestore.suggerimentoPassword }}</small>
    </div>
    <div class="field"><label>Server SMTP PEC</label><input v-model="modelValue.smtpHost" placeholder="smtps.pec-provider.it"></div>
    <div class="field"><label>Porta SMTP</label><input type="number" v-model.number="modelValue.smtpPort"></div>
    <div class="field">
      <label>Casella PEC mittente</label>
      <input v-model="modelValue.casellaMittente" :class="{ 'campo-non-valido': !casellaMittenteOk }" placeholder="nome@pec.it">
      <small v-if="!casellaMittenteOk" class="nota-errore">Formato email non valido.</small>
    </div>
    <div class="field"><label>Password casella PEC</label><input type="password" v-model="modelValue.passwordMittente"></div>
    <div class="field field-full full"><label>Destinatario SDI</label><input v-model="modelValue.destinatarioSdi"></div>
  </div>

  <div style="margin-top:16px">
    <button type="button" class="btn btn-ghost" :disabled="provaInCorso" @click="provaConnessione">
      {{ provaInCorso ? 'Prova in corso…' : 'Prova connessione' }}
    </button>
    <small class="note-legal">Usa i dati già salvati (salva prima di provare). Non invia nulla.</small>
    <ul v-if="prova" class="lista-prova">
      <li v-for="p in prova.passi" :key="p.id" :class="p.ok ? 'prova-ok' : 'prova-ko'">
        {{ p.ok ? '✓' : '✗' }} {{ p.etichetta }}<span v-if="!p.ok"> — {{ p.errore }}</span>
      </li>
    </ul>
  </div>

  <div style="margin-top:16px">
    <button type="button" class="btn btn-ghost" :disabled="provaSdiInCorso" @click="inviaProvaSdi">PEC di prova allo SDI</button>
    <small class="note-legal">Invia una PEC vuota, senza fattura: lo SDI risponde con un messaggio di cortesia. Attendi la risposta prima di riprovare.</small>
    <p v-if="provaSdi" :class="provaSdi.inviato ? 'prova-ok' : 'prova-ko'">
      {{ provaSdi.inviato ? 'PEC di prova inviata.' : provaSdi.errore }}
      <button v-if="provaSdi.inviato" type="button" class="btn btn-ghost" @click="leggiRisposte">Controlla risposte</button>
    </p>
    <p v-if="risposteSdi?.errore" class="prova-ko">{{ risposteSdi.errore }}</p>
    <ul v-else-if="risposteSdi" class="lista-prova">
      <li v-if="!risposteSdi.risposte.length">Nessuna risposta ancora: riprova tra qualche minuto.</li>
      <li v-for="(r, i) in risposteSdi.risposte" :key="i" class="prova-ok">{{ r.oggetto }} ({{ new Date(r.data).toLocaleString('it-IT') }})</li>
    </ul>
  </div>

  <p class="note-legal" style="margin-top:16px">
    Le fatture inviate tramite SDI restano archiviate solo localmente: non equivale a conservazione a norma
    (obbligo di legge, 10 anni). Attiva il servizio gratuito di conservazione dell'Agenzia delle Entrate —
    copre automaticamente e gratuitamente tutte le fatture transitate da SDI, adesione una tantum sul portale.
    <a href="https://www.agenziaentrate.gov.it/portale/aree-tematiche/fatturazione-elettronica/guida-fatturazione-elettronica/i-servizi-dell-agenzia-fe/servizio-conservazione-elettronica" target="_blank" rel="noopener">Attiva la conservazione su Agenzia Entrate</a>.
  </p>

    </div>
  </div>

  <div class="card">
    <div class="card-head"><h2>Ricezione ricevute SDI (IMAP)</h2></div>
    <div class="card-body">
  <p class="note-legal">
    Stessa casella PEC sopra, usata in sola lettura per scaricare automaticamente ricevute/notifiche
    SDI (consegna, scarto, mancata consegna, esiti, fattura firmata). Nessun'altra email nella
    casella viene toccata: legge solo i messaggi da <code>@pec.fatturapa.it</code>.
  </p>
  <div class="form-grid" style="margin-top:8px">
    <div class="field field-full full" style="flex-direction:row;align-items:center;gap:8px">
      <input id="sdi-polling-abilitato" type="checkbox" v-model="sdi.pollingAbilitato" style="width:auto">
      <label for="sdi-polling-abilitato" style="margin:0">Controllo ricevute SDI attivo (automatico e ping manuale)</label>
    </div>
    <div class="field"><label>Server IMAP PEC</label><input v-model="modelValue.imapHost" placeholder="imaps.pec-provider.it" :disabled="!sdi.pollingAbilitato"></div>
    <div class="field"><label>Porta IMAP</label><input type="number" v-model.number="modelValue.imapPort" :disabled="!sdi.pollingAbilitato"></div>
    <div class="field field-full full">
      <label>Cartella archivio locale (es. una cartella dentro Dropbox)</label>
      <input v-model="sdi.percorsoArchivio" placeholder="/Users/tuonome/Dropbox/Fatture/SDI" :disabled="!sdi.pollingAbilitato">
    </div>
    <div class="field"><label>Controllo automatico ogni (minuti)</label><input type="number" min="1" v-model.number="sdi.intervalloPollingMinuti" :disabled="!sdi.pollingAbilitato"></div>
  </div>
    </div>
  </div>
</template>

<style scoped>
.lista-prova { list-style: none; padding: 0; margin: 8px 0 0; }
.prova-ok { color: var(--ok); }
.prova-ko { color: var(--warn); }
</style>
