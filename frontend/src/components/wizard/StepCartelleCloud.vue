<script setup>
import { ref, computed, onMounted } from 'vue';
import { api } from '../../services/api.js';
import { chiediConferma, avvisa } from '../../composables/useConferma.js';
import SelectField from '../common/SelectField.vue';
import StepGoogleCloud from './StepGoogleCloud.vue';

const props = defineProps({ percorsoAttuale: { type: String, default: '' } });
const emit = defineEmits(['cambiata', 'google-scollegato']);

const cartelle = ref([]); // client trovati sul computer
const provider = ref('');
const radice = ref(''); // cartella del client: quella trovata o scelta dall'utente
const esito = ref(null); // { percorso, stato } della sottocartella dentro la radice
const messaggio = ref('');
const occupato = ref(false);
const googleRef = ref(null); // pannello di Google Drive (login e API), sempre montato: la migrazione lo usa anche a menu chiuso
const googleDisponibile = ref(false); // la build ha le chiavi dell'app, oppure Google è già collegato

const scelto = computed(() => cartelle.value.find((c) => c.provider === provider.value));
const conGoogle = computed(() => provider.value === 'google');
const inUso = computed(() => esito.value?.percorso === props.percorsoAttuale);
const daApplicare = computed(() => Boolean(esito.value) && !inUso.value);
const descrizioneStato = computed(() => ({
  assente: 'La cartella verrà creata e i dati attuali vi saranno spostati.',
  vuota: 'La cartella è vuota: i dati attuali vi saranno spostati.',
  archivio: 'Nella cartella c\'è già un archivio: verrà aperto e i dati attuali non vengono toccati.',
  estranea: 'La cartella esiste ma contiene file che non sono un archivio: svuotala o scegli un\'altra cartella del provider.',
}[esito.value?.stato] ?? ''));

async function esamina(r) {
  try {
    esito.value = await api.cartelleCloudEsamina(r, provider.value);
    radice.value = r;
  } catch (err) {
    esito.value = null;
    messaggio.value = `Errore: ${err.message}`;
  }
}

async function scegliProvider(valore) {
  provider.value = valore;
  messaggio.value = '';
  const c = cartelle.value.find((x) => x.provider === valore);
  if (c) await esamina(c.radice);
  else { radice.value = ''; esito.value = null; }
}

// Finestra di sistema (Finder o Esplora risorse): per chi ha spostato la cartella predefinita del client.
async function cambiaCartella() {
  occupato.value = true;
  try {
    const r = await api.cartelleCloudScegli(provider.value);
    if (!r.annullato) { radice.value = r.radice; esito.value = r; messaggio.value = ''; }
  } catch (err) {
    messaggio.value = `Errore: ${err.message}`;
  } finally {
    occupato.value = false;
  }
}

onMounted(async () => {
  try {
    cartelle.value = await api.cartelleCloud();
  } catch {
    cartelle.value = [];
  }
  const g = await api.cloudStato().catch(() => ({}));
  googleDisponibile.value = Boolean(g.disponibili?.google || (g.collegato && g.provider === 'google'));
  const attuale = cartelle.value.find((c) => props.percorsoAttuale === c.percorso);
  if (g.collegato && g.provider === 'google') provider.value = 'google';
  else if (attuale) await scegliProvider(attuale.provider);
});

// Chiamata dal Salva del wizard. true: fatto o niente da fare. false: l'utente ha rinunciato o c'è un errore.
async function salva() {
  if (!daApplicare.value) return true;
  if (esito.value.stato === 'estranea') {
    await avvisa(descrizioneStato.value, { titolo: `Archivio su ${scelto.value?.nome ?? 'cloud'}` });
    return false;
  }
  const apri = esito.value.stato === 'archivio';
  const nome = scelto.value?.nome ?? 'cloud';
  const ok = await chiediConferma(
    `${descrizioneStato.value}\n\n${esito.value.percorso}\n\n`
    + `La cartella è sincronizzata dal client di ${nome} installato su questo computer. L'app non può verificare che tutti i `
    + 'dispositivi vedano gli stessi dati aggiornati: se due dispositivi usano copie diverse o non aggiornate possono nascere dati '
    + 'non allineati e numeri di fattura duplicati, con conseguenze fiscali. Usa l\'archivio da un solo dispositivo alla volta e '
    + 'lascia finire la sincronizzazione prima di emettere una fattura.',
    { titolo: `Archivio su ${nome}`, ok: apri ? 'Apri' : 'Sposta' }
  );
  if (!ok) return false;
  occupato.value = true;
  try {
    // Un solo archivio attivo alla volta: se è su Google Drive va prima scollegato (nulla si cancella).
    const google = await api.cloudStato().catch(() => ({}));
    if (google.collegato) {
      const scollega = await chiediConferma(
        'L\'archivio è su Google Drive. Per usare questa cartella va prima scollegato: i dati restano su questo computer e su Google Drive non viene cancellato nulla.',
        { titolo: 'Scollega Google Drive', ok: 'Scollega' }
      );
      if (!scollega) return false;
      await api.cloudScollega();
      emit('google-scollegato');
    }
    const { percorso } = apri ? await api.apriArchivioEsistente(esito.value.percorso) : await api.spostaPercorsoDati(esito.value.percorso);
    emit('cambiata', percorso);
    await esamina(radice.value);
    return true;
  } catch (err) {
    messaggio.value = `Errore: ${err.message}`;
    return false;
  } finally {
    occupato.value = false;
  }
}

defineExpose({ salva, google: () => googleRef.value });
</script>

<template>
  <template v-if="cartelle.length || googleDisponibile">
    <h3 style="margin-top:24px">Archivio su cloud</h3>
    <p v-if="cartelle.length" class="note-legal">
      Dropbox e OneDrive: il client installato su questo computer, già collegato al tuo account, tiene l'archivio nella sottocartella
      indicata (<b>FogliFatture</b> dentro la cartella delle app), senza altri accessi né chiavi.
      Gli altri tuoi computer lo trovano con lo stesso client. Scegli il servizio e premi <b>Salva</b>.
      <template v-if="googleDisponibile">Google Drive: accedi con il tuo account, senza client.</template>
    </p>
    <div class="form-grid">
      <div class="field">
        <label>Servizio cloud</label>
        <SelectField :model-value="provider" titolo="Servizio cloud" descrizione="Dove tenere l'archivio" :disabled="occupato" @update:model-value="scegliProvider">
          <option value="">Nessuno (cartella dati attuale)</option>
          <option v-for="c in cartelle" :key="c.provider" :value="c.provider">{{ c.nome }}</option>
          <option v-if="googleDisponibile" value="google">Google Drive (accesso con account)</option>
        </SelectField>
      </div>
      <template v-if="esito && !conGoogle">
        <div class="field field-full full">
          <label>Cartella del servizio</label>
          <div style="display:flex;gap:12px;align-items:center">
            <input :value="radice" :title="radice" readonly style="flex:1;min-width:0;width:100%">
            <button class="btn btn-blue" type="button" :disabled="occupato" @click="cambiaCartella">Cambia…</button>
          </div>
        </div>
        <div class="field field-full full">
          <label>Sottocartella</label>
          <input :value="esito.sottocartella" readonly disabled style="width:100%">
        </div>
        <div class="field field-full full">
          <span class="note-legal">{{ inUso ? 'Questa cartella è in uso.' : descrizioneStato }}</span>
        </div>
      </template>
      <span v-if="messaggio" class="badge-mono">{{ messaggio }}</span>
    </div>
    <div v-show="conGoogle"><StepGoogleCloud ref="googleRef" /></div>
  </template>
</template>
