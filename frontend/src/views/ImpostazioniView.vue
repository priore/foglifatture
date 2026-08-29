<script setup>
// Wizard di configurazione: fornitore, cliente, tariffa/dati fiscali, PEC.
// I dati vengono salvati sul backend (config.json) ad ogni "Avanti"/"Salva".
import { ref, onMounted } from 'vue';
import WizardSteps from '../components/wizard/WizardSteps.vue';
import StepFornitore from '../components/wizard/StepFornitore.vue';
import StepCliente from '../components/wizard/StepCliente.vue';
import StepFatturazione from '../components/wizard/StepFatturazione.vue';
import StepPec from '../components/wizard/StepPec.vue';
import StepBackup from '../components/wizard/StepBackup.vue';
import StepPromemoria from '../components/wizard/StepPromemoria.vue';
import StepGoogleAuth from '../components/wizard/StepGoogleAuth.vue';
import { api } from '../services/api.js';

const PASSI = ['Fornitore', 'Cliente', 'Tariffa & fiscali', 'PEC', 'Backup', 'Promemoria', 'Login Google'];
// Lo step "Login Google" gestisce da sé il proprio salvataggio (scrive su .env, non su config.json).
const PASSI_AUTOSALVANTI = ['Login Google'];
const passoAttivo = ref(0);
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

// Salto diretto a un passo qualsiasi cliccando la tabbar: salva il passo corrente
// (se non autosalvante) prima di spostarsi, così i dati inseriti non si perdono.
async function vaiAlPasso(indice) {
  if (indice === passoAttivo.value) return;
  if (!eAutosalvante(passoAttivo.value)) await salva();
  passoAttivo.value = indice;
}
</script>

<template>
  <div v-if="config">
    <div class="page-head">
      <div><h1>Impostazioni</h1><p>Configurazione guidata: anagrafica, tariffa, invio</p></div>
    </div>

    <WizardSteps :passi="PASSI" :passo-attivo="passoAttivo" @vai="vaiAlPasso" />

    <div class="card">
      <div class="card-head"><h2>Passo {{ passoAttivo + 1 }} — {{ PASSI[passoAttivo] }}</h2></div>
      <div class="card-body">
        <StepFornitore v-if="passoAttivo === 0" v-model="config.fornitore" />
        <StepCliente v-else-if="passoAttivo === 1" v-model="config.cliente" />
        <StepFatturazione v-else-if="passoAttivo === 2" v-model="config.fatturazione" />
        <StepPec v-else-if="passoAttivo === 3" v-model="config.pec" :sdi="config.sdi" />
        <StepBackup v-else-if="passoAttivo === 4" v-model="config.backup" />
        <StepPromemoria v-else-if="passoAttivo === 5" v-model="config.reminder" />
        <StepGoogleAuth v-else />

        <div v-if="!eAutosalvante(passoAttivo)" style="margin-top:20px;display:flex;justify-content:space-between;align-items:center">
          <button class="btn btn-ghost" :disabled="passoAttivo === 0" @click="indietro">← Indietro</button>
          <span class="badge-mono">{{ messaggio }}</span>
          <button class="btn btn-primary" @click="avanti">
            {{ passoAttivo === PASSI.length - 1 ? 'Salva' : 'Avanti →' }}
          </button>
        </div>
        <div v-else style="margin-top:20px;display:flex;justify-content:flex-start">
          <button class="btn btn-ghost" @click="indietro">← Indietro</button>
        </div>
      </div>
    </div>
  </div>
</template>
