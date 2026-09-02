<script setup>
// Wizard di configurazione: fornitore, cliente, tariffa/dati fiscali, PEC.
// I dati vengono salvati sul backend (config.json) ad ogni "Avanti"/"Salva".
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter, onBeforeRouteUpdate } from 'vue-router';
import StepFornitore from '../components/wizard/StepFornitore.vue';
import StepClienti from '../components/wizard/StepClienti.vue';
import StepFatturazione from '../components/wizard/StepFatturazione.vue';
import StepPec from '../components/wizard/StepPec.vue';
import StepBackup from '../components/wizard/StepBackup.vue';
import StepPercorsoDati from '../components/wizard/StepPercorsoDati.vue';
import StepPromemoria from '../components/wizard/StepPromemoria.vue';
import StepGoogleAuth from '../components/wizard/StepGoogleAuth.vue';
import StepAI from '../components/wizard/StepAI.vue';
import { api } from '../services/api.js';
import { PASSI_IMPOSTAZIONI as PASSI, PASSI_AUTOSALVANTI, DESCRIZIONI_PASSI } from '../wizardImpostazioniPassi.js';

const route = useRoute();
const router = useRouter();
// Il passo attivo vive nella query string (?passo=N) invece che in uno stato locale,
// così le sotto-voci verticali in AppSidebar possono linkarci direttamente con router-link.
const passoAttivo = computed({
  get: () => {
    const n = Number(route.query.passo);
    return Number.isInteger(n) && n >= 0 && n < PASSI.length ? n : 0;
  },
  set: (n) => router.push({ query: { passo: n } }),
});
const config = ref(null);
const messaggio = ref('');

onMounted(async () => {
  config.value = await api.getConfig();
});

async function salva() {
  messaggio.value = 'Salvataggio…';
  try {
    config.value = await api.saveConfig(config.value);
    // Il backup automatico ha un proprio scheduler in background: va riavviato esplicitamente
    // dopo ogni salvataggio, altrimenti un cambio di cadenza/path richiederebbe il riavvio del server.
    config.value.backup = await api.salvaImpostazioniBackup(config.value.backup);
    config.value.reminder = await api.salvaImpostazioniReminder(config.value.reminder);
    messaggio.value = 'Salvato';
  } catch (err) {
    messaggio.value = `Errore: ${err.message}`;
  } finally {
    setTimeout(() => (messaggio.value = ''), 2000);
  }
}

function eAutosalvante(passo) {
  return PASSI_AUTOSALVANTI.includes(PASSI[passo]);
}

async function avanti() {
  if (passoAttivo.value < PASSI.length - 1) {
    if (!eAutosalvante(passoAttivo.value)) await salva();
    passoAttivo.value += 1;
  } else if (!eAutosalvante(passoAttivo.value)) {
    await salva();
  }
}

function indietro() {
  if (passoAttivo.value > 0) passoAttivo.value -= 1;
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
      <div><h1>Impostazioni</h1><p>{{ DESCRIZIONI_PASSI[PASSI[passoAttivo]] }}</p></div>
    </div>

    <div class="card">
      <div class="card-head"><h2>Passo {{ passoAttivo + 1 }} — {{ PASSI[passoAttivo] }}</h2></div>
      <div class="card-body">
        <StepFornitore v-if="passoAttivo === 0" v-model="config.fornitore" :forfettario="config.forfettario" />
        <StepClienti v-else-if="passoAttivo === 1" v-model="config.clienti" @salva-subito="salva" />
        <StepFatturazione v-else-if="passoAttivo === 2" v-model="config.fatturazione" />
        <StepPec v-else-if="passoAttivo === 3" v-model="config.pec" :sdi="config.sdi" />
        <StepPercorsoDati v-else-if="passoAttivo === 4" v-model="config.dati" />
        <StepBackup v-else-if="passoAttivo === 5" v-model="config.backup" />
        <StepPromemoria v-else-if="passoAttivo === 6" v-model="config.reminder" />
        <StepGoogleAuth v-else-if="passoAttivo === 7" />
        <StepAI v-else />

        <div v-if="!eAutosalvante(passoAttivo)" style="margin-top:20px;display:flex;justify-content:space-between;align-items:center">
          <button class="btn btn-ghost" :disabled="passoAttivo === 0" @click="indietro">← Indietro</button>
          <span class="badge-mono">{{ messaggio }}</span>
          <button class="btn btn-primary" @click="avanti">
            {{ passoAttivo === PASSI.length - 1 ? 'Salva' : 'Avanti →' }}
          </button>
        </div>
        <div v-else style="margin-top:20px;display:flex;justify-content:space-between;align-items:center">
          <button class="btn btn-ghost" @click="indietro">← Indietro</button>
          <button v-if="passoAttivo < PASSI.length - 1" class="btn btn-primary" @click="avanti">Avanti →</button>
        </div>
      </div>
    </div>
  </div>
</template>
