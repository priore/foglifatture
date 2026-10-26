<script setup>
import { ref, computed, onMounted } from 'vue';
import { api } from '../../services/api.js';
import { chiediConferma, avvisa } from '../../composables/useConferma.js';
import SelectField from '../common/SelectField.vue';

const props = defineProps({ percorsoAttuale: { type: String, default: '' } });
const emit = defineEmits(['cambiata']);

const SOTTOCARTELLA = 'FogliFatture'; // fissa: non si modifica
const cartelle = ref([]); // client trovati sul computer
const provider = ref('');
const radice = ref(''); // cartella del client: quella trovata o scelta dall'utente
const esito = ref(null); // { percorso, stato } della sottocartella dentro la radice
const messaggio = ref('');
const occupato = ref(false);

const scelto = computed(() => cartelle.value.find((c) => c.provider === provider.value));
const inUso = computed(() => esito.value?.percorso === props.percorsoAttuale);
const daApplicare = computed(() => Boolean(esito.value) && !inUso.value);
const descrizioneStato = computed(() => ({
  assente: 'La cartella FogliFatture verrà creata e i dati attuali vi saranno spostati.',
  vuota: 'La cartella FogliFatture è vuota: i dati attuali vi saranno spostati.',
  archivio: 'Nella cartella c\'è già un archivio: verrà aperto e i dati attuali non vengono toccati.',
  estranea: 'La cartella FogliFatture esiste ma contiene file che non sono un archivio: svuotala o scegli un\'altra cartella del provider.',
}[esito.value?.stato] ?? ''));

async function esamina(r) {
  try {
    esito.value = await api.cartelleCloudEsamina(r);
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
    const r = await api.cartelleCloudScegli();
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
  const attuale = cartelle.value.find((c) => props.percorsoAttuale === c.percorso);
  if (attuale) await scegliProvider(attuale.provider);
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

defineExpose({ salva });
</script>

<template>
  <template v-if="cartelle.length">
    <h3 style="margin-top:24px">Archivio su cloud</h3>
    <p class="note-legal">
      Sul computer sono installati i client di sincronizzazione elencati, già collegati al tuo account: l'archivio sta nella
      sottocartella <b>{{ SOTTOCARTELLA }}</b> della loro cartella, senza altri accessi né chiavi. Gli altri tuoi computer lo trovano con lo stesso client.
      Scegli il servizio e premi <b>Salva</b>.
    </p>
    <div class="form-grid">
      <div class="field">
        <label>Servizio cloud</label>
        <SelectField :model-value="provider" titolo="Servizio cloud" descrizione="Il client installato su questo computer in cui tenere l'archivio" :disabled="occupato" @update:model-value="scegliProvider">
          <option value="">Nessuno (cartella dati attuale)</option>
          <option v-for="c in cartelle" :key="c.provider" :value="c.provider">{{ c.nome }}</option>
        </SelectField>
      </div>
      <template v-if="esito">
        <div class="field field-full full">
          <label>Cartella del servizio</label>
          <div style="display:flex;gap:12px;align-items:center">
            <input :value="radice" :title="radice" readonly style="flex:1;min-width:0;width:100%">
            <button class="btn btn-ghost" type="button" :disabled="occupato" @click="cambiaCartella">Cambia…</button>
          </div>
        </div>
        <div class="field field-full full">
          <label>Sottocartella</label>
          <input :value="SOTTOCARTELLA" readonly disabled style="width:100%">
        </div>
        <div class="field field-full full">
          <span class="note-legal">{{ inUso ? 'Questa cartella è in uso.' : descrizioneStato }}</span>
        </div>
      </template>
      <span v-if="messaggio" class="badge-mono">{{ messaggio }}</span>
    </div>
  </template>
</template>
