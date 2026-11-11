<script setup>
// Wizard di configurazione: fornitore (anagrafica, fiscali, pagamento), PEC.
// I dati vengono salvati sul backend (config.json) al "Salva".
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter, onBeforeRouteUpdate } from 'vue-router';
import StepFornitore from '../components/wizard/StepFornitore.vue';
import StepPec from '../components/wizard/StepPec.vue';
import StepBackup from '../components/wizard/StepBackup.vue';
import StepPercorsoDati from '../components/wizard/StepPercorsoDati.vue';
import StepPromemoria from '../components/wizard/StepPromemoria.vue';
import StepGoogleAuth from '../components/wizard/StepGoogleAuth.vue';
import StepAI from '../components/wizard/StepAI.vue';
import { api } from '../services/api.js';
import { PASSI_IMPOSTAZIONI, PASSI_AUTOSALVANTI, DESCRIZIONI_PASSI, componentePasso } from '../wizardImpostazioniPassi.js';

const PASSI = PASSI_IMPOSTAZIONI; // computed: le estensioni possono aggiungere passi in coda
const route = useRoute();
const router = useRouter();
// Il passo attivo vive nella query string (?passo=N) invece che in uno stato locale,
// così le sotto-voci verticali in AppSidebar possono linkarci direttamente con router-link.
const passoAttivo = computed({
  get: () => {
    // `?passo=` è l'indice, oppure il nome del passo (link nativi, dove l'elenco dei passi dipende dal dispositivo).
    const q = route.query.passo;
    const n = /^\d+$/.test(q) ? Number(q) : PASSI.value.indexOf(q);
    return Number.isInteger(n) && n >= 0 && n < PASSI.value.length ? n : 0;
  },
  set: (n) => router.push({ query: { ...route.query, passo: n } }),
});
// Titolo nelle shell compatte: «Passo - Scheda» per i passi che hanno schede interne (scelte dal foglio nativo con `?sub=`).
const SCHEDE_PASSO = {
  Fornitore: { Anagrafica: 'Anagrafica', Fiscale: 'Fiscale', Fatturazione: 'Fatturazione' },
  AI: { gemini: 'Gemini', copilot: 'Copilot', claude: 'Claude', groq: 'Groq', locale: 'Locale' },
};
const titoloCompatto = computed(() => {
  const passo = PASSI.value[passoAttivo.value];
  const schede = SCHEDE_PASSO[passo];
  if (!schede) return passo;
  return `${passo} - ${schede[route.query.sub] ?? Object.values(schede)[0]}`;
});
const config = ref(null);
const messaggio = ref('');
const passoRef = ref(null); // il passo può esporre `salva()` per applicare scelte che non stanno in config.json

onMounted(async () => {
  config.value = await api.getConfig();
});

// Restituisce false se il passo ha rinunciato (annullo nel popup) o il salvataggio è fallito: il chiamante non procede.
async function salva() {
  messaggio.value = 'Salvataggio…';
  try {
    if ((await passoRef.value?.salva?.()) === false) {
      messaggio.value = '';
      return false;
    }
    config.value = await api.saveConfig(config.value);
    // Il backup automatico ha un proprio scheduler in background: va riavviato esplicitamente
    // dopo ogni salvataggio, altrimenti un cambio di cadenza/path richiederebbe il riavvio del server.
    config.value.backup = await api.salvaImpostazioniBackup(config.value.backup);
    config.value.reminder = await api.salvaImpostazioniReminder(config.value.reminder);
    messaggio.value = 'Salvato';
    return true;
  } catch (err) {
    messaggio.value = `Errore: ${err.message}`;
    return false;
  } finally {
    setTimeout(() => (messaggio.value = ''), 2000);
  }
}

function eAutosalvante(passo) {
  return PASSI_AUTOSALVANTI.includes(PASSI.value[passo]);
}

// Click su una sotto-voce diversa in AppSidebar: salva il passo corrente (se non
// autosalvante) prima che la query cambi davvero, così i dati inseriti non si perdono.
onBeforeRouteUpdate(async (to, from, next) => {
  if (to.query.passo !== from.query.passo && !eAutosalvante(passoAttivo.value)) {
    await salva();
  }
  next();
});
</script>

<template>
  <div v-if="config">
    <div class="page-head">
      <div><h1><span class="solo-desktop">Impostazioni</span><span class="solo-compatto">{{ titoloCompatto }}</span></h1><p>{{ DESCRIZIONI_PASSI[PASSI[passoAttivo]] }}</p></div>
    </div>

    <div class="card card-passo">
      <div class="card-head"><h2><span class="wizard-nav">Passo {{ passoAttivo + 1 }} — </span>{{ PASSI[passoAttivo] }}</h2></div>
      <div class="card-body">
        <StepFornitore v-if="PASSI[passoAttivo] === 'Fornitore'" v-model="config.fornitore" :forfettario="config.forfettario" :fatturazione="config.fatturazione" :wallet-btc="config.walletBtc" :import-btc="config.importBtc" />
        <StepPec v-else-if="PASSI[passoAttivo] === 'PEC'" v-model="config.pec" :sdi="config.sdi" />
        <StepPercorsoDati v-else-if="PASSI[passoAttivo] === 'Percorso dati'" ref="passoRef" v-model="config.dati" />
        <StepBackup v-else-if="PASSI[passoAttivo] === 'Backup Automatico'" v-model="config.backup" />
        <StepPromemoria v-else-if="PASSI[passoAttivo] === 'Promemoria'" v-model="config.reminder" :notifiche="config.notifiche" />
        <StepGoogleAuth v-else-if="PASSI[passoAttivo] === 'Login'" />
        <StepAI v-else-if="PASSI[passoAttivo] === 'AI'" />
        <component :is="componentePasso(PASSI[passoAttivo])" v-else />

        <div v-if="!eAutosalvante(passoAttivo)" style="margin-top:20px;display:flex;justify-content:flex-end;align-items:center;gap:12px">
          <span class="badge-mono">{{ messaggio }}</span>
          <button class="btn btn-ok" @click="salva">Salva</button>
        </div>
      </div>
    </div>
  </div>
</template>
