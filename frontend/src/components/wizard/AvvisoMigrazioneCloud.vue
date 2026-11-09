<script setup>
// Avviso fisso per chi ha già l'archivio nella vecchia posizione `<client>/FogliFatture`: un solo pulsante esegue tutta la
// migrazione. Nulla parte da solo; le scelte intermedie compaiono solo se la nuova posizione ha già un archivio.
import { ref, onMounted } from 'vue';
import { api } from '../../services/api.js';
import { chiediConferma, avvisa } from '../../composables/useConferma.js';

const props = defineProps({ google: { type: Object, default: null } }); // istanza di StepGoogleCloud (login e API)
const emit = defineEmits(['cambiata']);

const situazione = ref(null);
const occupato = ref(false);
const messaggio = ref('');

async function carica() {
  try { situazione.value = await api.migrazioneCloud(); } catch { situazione.value = null; }
}
onMounted(carica);

async function migraClient() {
  const s = situazione.value;
  if (s.statoNuovo === 'estranea') {
    await avvisa(`La cartella ${s.nuovo} contiene file che non sono un archivio: svuotala e riprova.`, { titolo: `Archivio su ${s.nome}` });
    return;
  }
  const apri = s.statoNuovo === 'archivio';
  const ok = await chiediConferma(
    apri
      ? `Nella nuova cartella c'è già un archivio (per esempio creato su un altro computer). Aprilo: i dati attuali di questo computer non vengono toccati e restano nella cartella di prima.\n\n${s.nuovo}`
      : `I dati si spostano nella nuova cartella. La vecchia cartella, ormai vuota, sparisce.\n\n${s.nuovo}`,
    { titolo: `Archivio su ${s.nome}`, ok: apri ? 'Apri' : 'Sposta' }
  );
  if (!ok) return;
  const { percorso } = await api.migraCloudClient(apri ? 'apri' : 'sposta');
  emit('cambiata', percorso);
  await carica();
  await avvisa('Archivio passato alla nuova cartella.', { titolo: 'Fatto' });
}

async function migraGoogle() {
  if (!props.google) return;
  const ok = await chiediConferma(
    'Accedi al tuo account Google: i dati di questo computer vengono copiati sul tuo Drive (o si apre l\'archivio già presente) e restano sincronizzati. La cartella attuale non viene toccata.',
    { titolo: 'Archivio su Google Drive', ok: 'Continua' }
  );
  if (ok && await props.google.migra()) window.location.reload();
}

async function passa() {
  occupato.value = true;
  messaggio.value = '';
  try {
    await (situazione.value.provider === 'google' ? migraGoogle() : migraClient());
  } catch (err) {
    messaggio.value = `Errore: ${err.message}`;
  } finally {
    occupato.value = false;
  }
}
</script>

<template>
  <div v-if="situazione" class="avviso-numerazione" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
    <span style="flex:1;min-width:16rem">
      Il tuo archivio è nella vecchia cartella <b>FogliFatture</b> di {{ situazione.nome }}. Passa al nuovo archivio.
    </span>
    <button class="btn btn-ok" type="button" :disabled="occupato" @click="passa">Passa al nuovo archivio</button>
    <span v-if="messaggio" class="badge-mono">{{ messaggio }}</span>
  </div>
</template>
