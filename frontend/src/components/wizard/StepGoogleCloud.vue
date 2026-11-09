<script setup>
// Archivio su Google Drive: login con l'account (nessun client installato), l'app vede solo la propria cartella.
// Si mostra solo se la build ha le chiavi dell'app (`disponibili.google`) o se Google è già collegato.
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { api } from '../../services/api.js';
import { chiediConferma, avvisa } from '../../composables/useConferma.js';

const MSG_GENERICO = 'Impossibile completare il collegamento. Riprova.';
const stato = ref({ collegato: false });
const messaggio = ref('');
const occupato = ref(false);
const inAttesa = ref(false);
let timer = null;

const attivo = computed(() => stato.value.collegato && stato.value.provider === 'google');
const visibile = computed(() => attivo.value || (!stato.value.collegato && stato.value.disponibili?.google));
const senzaArchivio = computed(() => attivo.value && stato.value.connesso && !stato.value.archivio);

async function aggiorna() {
  try { stato.value = await api.cloudStato(); } catch (err) { messaggio.value = `Errore: ${err.message}`; }
}

async function esegui(azione, ok = '') {
  occupato.value = true;
  messaggio.value = '';
  try {
    await azione();
    messaggio.value = ok;
  } catch (err) {
    messaggio.value = `Errore: ${err.message}`;
  } finally {
    occupato.value = false;
    await aggiorna();
  }
}

// Il login si completa nel browser di sistema e torna su /api/cloud/callback: qui si attende che lo stato cambi.
// Restituisce una promessa: true se il collegamento è riuscito.
function attendi() {
  clearInterval(timer);
  inAttesa.value = true;
  let tentativi = 0;
  return new Promise((risolvi) => {
    timer = setInterval(async () => {
      await aggiorna();
      if (attivo.value && stato.value.connesso || ++tentativi > 150) {
        clearInterval(timer);
        inAttesa.value = false;
        const riuscito = Boolean(attivo.value && stato.value.connesso);
        messaggio.value = riuscito ? 'Collegato' : MSG_GENERICO;
        risolvi(riuscito);
      }
    }, 2000);
  });
}

async function avviaLogin() {
  const { url } = await api.cloudLogin({ provider: 'google', redirectUri: `http://127.0.0.1:${location.port}/api/cloud/callback` });
  window.open(url, '_blank', 'noopener');
  messaggio.value = 'Autorizza l\'app su Google nel browser, poi torna qui.';
}

const collega = () => esegui(async () => {
  await avviaLogin();
  attendi();
});

// Migrazione di chi aveva l'archivio nella cartella del client Google: login se serve, poi apre l'archivio già presente
// sull'account o vi carica i dati attuali. La vecchia cartella non si tocca. true se l'archivio è passato su Google via API.
async function migra() {
  occupato.value = true;
  messaggio.value = '';
  try {
    await aggiorna();
    if (!attivo.value || !stato.value.connesso) {
      await avviaLogin();
      if (!await attendi()) return false;
    }
    if (stato.value.remoto === 'estraneo') {
      await avvisa('La cartella dell\'app su Google Drive contiene file che non sono un archivio: svuotala e riprova.', { titolo: 'Archivio su Google Drive' });
      return false;
    }
    let azione = 'carica';
    if (stato.value.remoto === 'archivio') {
      const apri = await chiediConferma(
        'Sul tuo Google Drive c\'è già un archivio (per esempio creato su un altro computer). Aprilo: i dati di questo computer non vengono toccati e restano nella cartella di prima.',
        { titolo: 'Archivio su Google Drive', ok: 'Apri' }
      );
      if (!apri) return false;
      azione = 'apri';
    }
    await api.cloudArchivio(azione);
    await avvisa(
      'Archivio passato su Google Drive. La vecchia cartella FogliFatture nel tuo Drive non serve più: finché c\'è, il client Google può mostrare due cartelle con lo stesso nome. Puoi eliminarla o rinominarla quando vuoi.',
      { titolo: 'Fatto' }
    );
    return true;
  } catch (err) {
    messaggio.value = `Errore: ${err.message}`;
    return false;
  } finally {
    occupato.value = false;
    await aggiorna();
  }
}

async function scegli(azione) {
  const apri = azione === 'apri';
  const ok = await chiediConferma(
    apri
      ? 'Apri l\'archivio trovato su Google Drive. I dati attuali di questo computer non vengono toccati: restano nella cartella di prima.'
      : 'Carica i dati di questo computer su Google Drive. I dati attuali non vengono toccati. Nella tua area «Il mio Drive» l\'app crea una cartella FogliFatture nuova: se ne hai già una con quel nome, che non serve più, eliminala o rinominala per non confonderle.',
    { titolo: apri ? 'Apri archivio' : 'Carica archivio', ok: apri ? 'Apri' : 'Carica' }
  );
  if (ok) await esegui(() => api.cloudArchivio(azione), apri ? 'Archivio aperto' : 'Archivio caricato');
}

async function scollega() {
  const ok = await chiediConferma(
    'I dati restano su questo computer ma non si sincronizzano più. Su Google Drive non viene cancellato nulla.',
    { titolo: 'Scollega Google Drive', ok: 'Scollega' }
  );
  if (ok) await esegui(() => api.cloudScollega(), 'Scollegato');
}

onMounted(aggiorna);
onUnmounted(() => clearInterval(timer));
defineExpose({ aggiorna, migra });
</script>

<template>
  <template v-if="visibile">
    <p class="note-legal">
      Accedi al tuo account Google: l'archivio sta in una cartella <b>FogliFatture</b> creata dall'app, che vede solo quella,
      e si ritrova uguale su ogni computer con lo stesso account. Offline le modifiche restano in coda e l'emissione delle
      fatture è bloccata, perché il numero va riservato su Google Drive.
    </p>
    <div v-if="!attivo" class="form-grid">
      <div class="field field-full full" style="flex-direction:row;align-items:center;gap:12px">
        <button class="btn btn-ok" type="button" :disabled="occupato || inAttesa" @click="collega">Collega Google Drive</button>
        <span v-if="messaggio" class="badge-mono">{{ messaggio }}</span>
      </div>
    </div>
    <div v-else class="form-grid">
      <div class="field field-full full">
        <label>Google Drive</label>
        <span class="badge-mono">
          <template v-if="!stato.connesso">Disconnesso</template>
          <template v-else-if="!stato.archivio">Collegato, archivio da scegliere</template>
          <template v-else>Sincronizzato{{ stato.ultimaSync ? ` il ${new Date(stato.ultimaSync).toLocaleString('it-IT')}` : '' }}</template>
          <template v-if="stato.inAttesa"> · {{ stato.inAttesa }} modifiche in coda</template>
        </span>
        <span v-if="stato.errore" class="note-legal">{{ stato.errore }}</span>
        <span v-if="stato.conflitti?.length" class="note-legal">
          {{ stato.conflitti.length }} file modificati su due dispositivi: ha prevalso la versione di Google Drive e la tua
          è nella cartella «conflitti» dell'archivio: {{ stato.conflitti.join(', ') }}.
        </span>
        <span v-if="senzaArchivio && stato.remoto === 'estraneo'" class="note-legal">
          La cartella dell'app su Google Drive contiene file che non appartengono a un archivio: svuotala o scollega.
        </span>
      </div>
      <div class="field field-full full" style="flex-direction:row;align-items:center;gap:12px">
        <button v-if="senzaArchivio" class="btn btn-blue" type="button" :disabled="occupato || stato.remoto !== 'archivio'" @click="scegli('apri')">Apri archivio trovato</button>
        <button v-if="senzaArchivio" class="btn btn-ok" type="button" :disabled="occupato || stato.remoto !== 'vuoto'" @click="scegli('carica')">Carica i miei dati</button>
        <button v-if="stato.archivio && stato.connesso" class="btn btn-ok" type="button" :disabled="occupato" @click="esegui(() => api.cloudSincronizza(), 'Sincronizzato')">Sincronizza ora</button>
        <button v-if="!stato.connesso" class="btn btn-ok" type="button" :disabled="occupato" @click="collega">Ricollega</button>
        <button class="btn btn-warn" type="button" :disabled="occupato" @click="scollega">Scollega</button>
        <span v-if="messaggio" class="badge-mono">{{ messaggio }}</span>
      </div>
    </div>
  </template>
</template>
