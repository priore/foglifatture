<script setup>
// Configurazione della API key Gemini (free tier), usata per aggiornare l'elenco codici ATECO,
// i coefficienti di redditività forfettario e le scadenze fiscali. Come "Google", questi dati
// vivono in backend/.env (non in config.json).
import { ref, onMounted } from 'vue';
import { api } from '../../services/api.js';

const geminiApiKey = ref('');
const geminiApiKeyImpostata = ref(false);
const messaggioGemini = ref('');
const salvandoGemini = ref(false);

const modelliDisponibili = ref([]);
const modelloScelto = ref('');
const caricandoModelli = ref(false);
const verificandoModello = ref(false);
const messaggioModello = ref('');

onMounted(async () => {
  const dati = await api.getOAuthConfig();
  geminiApiKeyImpostata.value = dati.geminiApiKeyImpostata;
  modelloScelto.value = dati.geminiModello || '';
});

async function caricaModelli() {
  caricandoModelli.value = true;
  messaggioModello.value = '';
  try {
    const { modelli } = await api.modelliGemini();
    modelliDisponibili.value = modelli;
    if (!modelloScelto.value && modelli.length) modelloScelto.value = modelli[0];
  } catch (err) {
    messaggioModello.value = `Errore: ${err.message}`;
  } finally {
    caricandoModelli.value = false;
  }
}

async function verificaModello() {
  verificandoModello.value = true;
  messaggioModello.value = '';
  try {
    const risultato = await api.verificaModelloGemini(modelloScelto.value);
    messaggioModello.value = risultato.messaggio;
  } catch (err) {
    messaggioModello.value = `Errore: ${err.message}`;
  } finally {
    verificandoModello.value = false;
  }
}

async function salvaGemini() {
  salvandoGemini.value = true;
  messaggioGemini.value = '';
  try {
    const risultato = await api.saveOAuthConfig({
      geminiApiKey: geminiApiKey.value, // vuoto = non modificare la key esistente
    });
    messaggioGemini.value = risultato.messaggio;
    if (geminiApiKey.value) geminiApiKeyImpostata.value = true;
    geminiApiKey.value = '';
  } catch (err) {
    messaggioGemini.value = `Errore: ${err.message}`;
  } finally {
    salvandoGemini.value = false;
  }
}
</script>

<template>
  <div>
    <p class="note-legal">
      API key Gemini (free tier), usata per aggiornare l'elenco codici ATECO e i coefficienti
      di redditività forfettario (Impostazioni → Forfettario, icona ⟳ accanto al campo Codice ATECO),
      le scadenze fiscali in dashboard, e come sorgente primaria per il mapping colonne CSV pagamenti
      (con fallback automatico su Groq se la quota è esaurita). Non serve per il login: puoi lasciarla
      vuota se non usi queste funzioni.
    </p>

    <div class="form-grid" style="margin-top:16px">
      <div class="field full">
        <label>Gemini API Key {{ geminiApiKeyImpostata ? '(già impostata — lascia vuoto per non cambiarla)' : '' }}</label>
        <input type="password" v-model="geminiApiKey" :placeholder="geminiApiKeyImpostata ? '••••••••' : ''">
      </div>
    </div>

    <div style="margin-top:16px;display:flex;align-items:center;gap:12px">
      <button class="btn btn-primary" :disabled="salvandoGemini" @click="salvaGemini">{{ salvandoGemini ? 'Salvo…' : 'Salva API key' }}</button>
      <span class="badge-mono" v-if="messaggioGemini">{{ messaggioGemini }}</span>
    </div>

    <div class="card" style="margin-top:24px">
      <div class="card-head"><h2>Modello Gemini</h2></div>
      <div class="card-body">
        <p class="note-legal">
          Scegli tra i modelli disponibili per la tua API key (elenco recuperato in tempo reale da Google)
          e verificalo con una chiamata di prova prima di usarlo.
        </p>
        <div class="form-grid" style="margin-top:12px">
          <div class="field full" style="display:flex;align-items:center;gap:12px">
            <select v-model="modelloScelto" style="flex:1">
              <option value="" disabled>{{ modelliDisponibili.length ? 'Seleziona un modello' : 'Carica l\'elenco modelli' }}</option>
              <option v-if="modelloScelto && !modelliDisponibili.includes(modelloScelto)" :value="modelloScelto">{{ modelloScelto }}</option>
              <option v-for="m in modelliDisponibili" :key="m" :value="m">{{ m }}</option>
            </select>
            <button class="btn" :disabled="caricandoModelli" @click="caricaModelli">{{ caricandoModelli ? 'Carico…' : 'Carica elenco' }}</button>
            <button class="btn btn-primary" :disabled="!modelloScelto || verificandoModello" @click="verificaModello">{{ verificandoModello ? 'Verifico…' : 'Verifica e salva' }}</button>
          </div>
        </div>
        <span class="badge-mono" v-if="messaggioModello" style="display:inline-block;margin-top:8px">{{ messaggioModello }}</span>
      </div>
    </div>

    <div class="card" style="margin-top:24px">
      <div class="card-head"><h2>Come ottenere una Gemini API Key</h2></div>
      <div class="card-body">
        <ol style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:10px;font-size:.88rem;line-height:1.6">
          <li>Vai su <strong>aistudio.google.com/apikey</strong> e accedi con il tuo account Google.</li>
          <li>Clicca <strong>Create API key</strong>, scegli o crea un progetto, e copia la chiave generata.</li>
          <li>Incollala nel campo qui sopra e salva: vale subito, senza bisogno di riavviare il servizio.</li>
        </ol>
      </div>
    </div>
  </div>
</template>
