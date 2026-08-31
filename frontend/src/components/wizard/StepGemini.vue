<script setup>
// Configurazione della API key Gemini (free tier), usata solo per aggiornare
// l'elenco codici ATECO e i coefficienti di redditività forfettario.
// Come "Google", questi dati vivono in backend/.env (non in config.json).
import { ref, onMounted } from 'vue';
import { api } from '../../services/api.js';

const geminiApiKey = ref('');
const geminiApiKeyImpostata = ref(false);
const messaggioGemini = ref('');
const salvandoGemini = ref(false);

onMounted(async () => {
  const dati = await api.getOAuthConfig();
  geminiApiKeyImpostata.value = dati.geminiApiKeyImpostata;
});

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
    <h2>Gemini</h2>
    <p class="note-legal">
      API key Gemini (free tier), usata solo per aggiornare l'elenco codici ATECO e i coefficienti
      di redditività forfettario da Impostazioni → Forfettario (icona ⟳ accanto al campo Codice ATECO).
      Non serve per il login: puoi lasciarla vuota se non usi quella funzione.
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
