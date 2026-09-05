<script setup>
// Configurazione della API key Groq (free tier), usata solo come fallback automatico
// quando la quota gratuita Gemini è esaurita, per il mapping colonne CSV pagamenti
// (vedi pagamentiFattureService.js). Nessuna ricerca web: Groq copre solo i compiti
// che non richiedono grounding. Come "Gemini", questi dati vivono in backend/.env
// (non in config.json).
import { ref, onMounted } from 'vue';
import { api } from '../../services/api.js';

const MODELLI_NOTI = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'qwen/qwen3-32b', 'moonshotai/kimi-k2-instruct'];

const groqApiKey = ref('');
const groqApiKeyImpostata = ref(false);
const messaggioGroq = ref('');
const salvandoGroq = ref(false);

const modelloScelto = ref('');
const verificandoModello = ref(false);
const messaggioModello = ref('');

onMounted(async () => {
  const dati = await api.getOAuthConfig();
  groqApiKeyImpostata.value = dati.groqApiKeyImpostata;
  modelloScelto.value = dati.groqModello || MODELLI_NOTI[0];
});

async function verificaModello() {
  verificandoModello.value = true;
  messaggioModello.value = '';
  try {
    const risultato = await api.verificaModelloGroq(modelloScelto.value);
    messaggioModello.value = risultato.messaggio;
  } catch (err) {
    messaggioModello.value = `Errore: ${err.message}`;
  } finally {
    verificandoModello.value = false;
  }
}

async function salvaGroq() {
  salvandoGroq.value = true;
  messaggioGroq.value = '';
  try {
    const risultato = await api.saveOAuthConfig({
      groqApiKey: groqApiKey.value, // vuoto = non modificare la key esistente
    });
    messaggioGroq.value = risultato.messaggio;
    if (groqApiKey.value) groqApiKeyImpostata.value = true;
    groqApiKey.value = '';
  } catch (err) {
    messaggioGroq.value = `Errore: ${err.message}`;
  } finally {
    salvandoGroq.value = false;
  }
}
</script>

<template>
  <div>
    <p class="note-legal">
      API key Groq (free tier), usata solo come <strong>fallback automatico</strong> per il
      riconoscimento colonne CSV pagamenti (Impostazioni → Percorso dati → Importa storico →
      Pagamenti fatture), quando la quota gratuita giornaliera di Gemini è esaurita. Facoltativa:
      senza key configurata, in quel caso l'operazione fallisce e va ripetuta manualmente dopo il
      reset della quota Gemini.
    </p>

    <div class="form-grid" style="margin-top:16px">
      <div class="field full">
        <label>Groq API Key {{ groqApiKeyImpostata ? '(già impostata — lascia vuoto per non cambiarla)' : '' }}</label>
        <input type="password" v-model="groqApiKey" :placeholder="groqApiKeyImpostata ? '••••••••' : ''">
      </div>
    </div>

    <div style="margin-top:16px;display:flex;align-items:center;gap:12px">
      <button class="btn btn-primary" :disabled="salvandoGroq" @click="salvaGroq">{{ salvandoGroq ? 'Salvo…' : 'Salva API key' }}</button>
      <span class="badge-mono" v-if="messaggioGroq">{{ messaggioGroq }}</span>
    </div>

    <div class="card" style="margin-top:24px">
      <div class="card-head"><h2>Modello Groq</h2></div>
      <div class="card-body">
        <p class="note-legal">
          Scegli un modello tra quelli attualmente disponibili sul free tier Groq e verificalo
          con una chiamata di prova prima di salvarlo.
        </p>
        <div class="form-grid" style="margin-top:12px">
          <div class="field full" style="display:flex;align-items:center;gap:12px">
            <select v-model="modelloScelto" style="flex:1">
              <option v-if="modelloScelto && !MODELLI_NOTI.includes(modelloScelto)" :value="modelloScelto">{{ modelloScelto }}</option>
              <option v-for="m in MODELLI_NOTI" :key="m" :value="m">{{ m }}</option>
            </select>
            <button class="btn btn-primary" :disabled="!modelloScelto || verificandoModello" @click="verificaModello">{{ verificandoModello ? 'Verifico…' : 'Verifica e salva' }}</button>
          </div>
        </div>
        <span class="badge-mono" v-if="messaggioModello" style="display:inline-block;margin-top:8px">{{ messaggioModello }}</span>
      </div>
    </div>

    <div class="card" style="margin-top:24px">
      <div class="card-head"><h2>Come ottenere una Groq API Key</h2></div>
      <div class="card-body">
        <ol style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:10px;font-size:.88rem;line-height:1.6">
          <li>Vai su <strong>console.groq.com</strong> e accedi (email o Google/GitHub).</li>
          <li>Vai in <strong>API Keys</strong>, crea una nuova chiave e copiala.</li>
          <li>Incollala nel campo qui sopra e salva: vale subito, senza bisogno di riavviare il servizio.</li>
        </ol>
      </div>
    </div>
  </div>
</template>
