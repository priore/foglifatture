<script setup>
// Configurazione della API key Claude (Anthropic), usata come secondo fallback (dopo Gemini,
// prima di Groq) quando la quota gratuita Gemini è esaurita: mapping colonne CSV pagamenti
// e prossime scadenze fiscali (vedi pagamentiFattureService.js/scadenzeFiscaliService.js).
// Nessuna ricerca web: risposta basata solo sulla conoscenza del modello. Come "Gemini"/"Groq",
// questi dati vivono in backend/.env (nome modello) + Keychain OS (API key), non in config.json.
import { ref, onMounted } from 'vue';
import { api } from '../../services/api.js';

const MODELLI_NOTI = ['claude-haiku-4-5', 'claude-sonnet-5', 'claude-opus-5'];

const claudeApiKey = ref('');
const claudeApiKeyImpostata = ref(false);
const claudeWorkspaceId = ref('');
const messaggioClaude = ref('');
const salvandoClaude = ref(false);

const modelloScelto = ref('');
const verificandoModello = ref(false);
const messaggioModello = ref('');

onMounted(async () => {
  const dati = await api.getOAuthConfig();
  claudeApiKeyImpostata.value = dati.claudeApiKeyImpostata;
  claudeWorkspaceId.value = dati.claudeWorkspaceId || '';
  modelloScelto.value = dati.claudeModello || MODELLI_NOTI[0];
});

async function verificaModello() {
  verificandoModello.value = true;
  messaggioModello.value = '';
  try {
    const risultato = await api.verificaModelloClaude(modelloScelto.value);
    messaggioModello.value = risultato.messaggio;
  } catch (err) {
    messaggioModello.value = `Errore: ${err.message}`;
  } finally {
    verificandoModello.value = false;
  }
}

async function salvaClaude() {
  salvandoClaude.value = true;
  messaggioClaude.value = '';
  try {
    const risultato = await api.saveOAuthConfig({
      claudeApiKey: claudeApiKey.value, // vuoto = non modificare la key esistente
      claudeWorkspaceId: claudeWorkspaceId.value,
    });
    messaggioClaude.value = risultato.messaggio;
    if (claudeApiKey.value) claudeApiKeyImpostata.value = true;
    claudeApiKey.value = '';
  } catch (err) {
    messaggioClaude.value = `Errore: ${err.message}`;
  } finally {
    salvandoClaude.value = false;
  }
}
</script>

<template>
  <div>
    <p class="note-legal">
      API key Claude (Anthropic), usata come <strong>secondo fallback</strong> (dopo Gemini,
      prima di Groq) per il riconoscimento colonne CSV pagamenti e le prossime scadenze fiscali
      in dashboard, quando la quota gratuita giornaliera di Gemini è esaurita. Facoltativa:
      senza key configurata, in quel caso si passa direttamente al fallback Groq (se configurato).
    </p>

    <div class="form-grid" style="margin-top:16px">
      <div class="field full">
        <label>Claude API Key {{ claudeApiKeyImpostata ? '(già impostata — lascia vuoto per non cambiarla)' : '' }}</label>
        <input type="password" v-model="claudeApiKey" :placeholder="claudeApiKeyImpostata ? '••••••••' : ''">
      </div>
      <div class="field full">
        <label>Workspace ID (solo se richiesto)</label>
        <input type="text" v-model="claudeWorkspaceId" placeholder="wrkspc_...">
        <p class="note-legal" style="margin-top:6px">
          Necessario solo se l'API key è collegata a più workspace dell'organizzazione: in quel
          caso Claude risponde con l'errore "anthropic-workspace-id is required". Trovi l'ID in
          console.anthropic.com → Settings → Workspaces. Lascia vuoto se non serve.
        </p>
      </div>
    </div>

    <div style="margin-top:16px;display:flex;align-items:center;gap:12px">
      <button class="btn btn-primary" :disabled="salvandoClaude" @click="salvaClaude">{{ salvandoClaude ? 'Salvo…' : 'Salva API key' }}</button>
      <span class="badge-mono" v-if="messaggioClaude">{{ messaggioClaude }}</span>
    </div>

    <div class="card" style="margin-top:24px">
      <div class="card-head"><h2>Modello Claude</h2></div>
      <div class="card-body">
        <p class="note-legal">
          Scegli un modello Claude e verificalo con una chiamata di prova prima di salvarlo.
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
      <div class="card-head"><h2>Come ottenere una Claude API Key</h2></div>
      <div class="card-body">
        <ol style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:10px;font-size:.88rem;line-height:1.6">
          <li>Vai su <strong>console.anthropic.com</strong> e accedi.</li>
          <li>Vai in <strong>API Keys</strong>, crea una nuova chiave e copiala.</li>
          <li>Incollala nel campo qui sopra e salva: vale subito, senza bisogno di riavviare il servizio.</li>
        </ol>
      </div>
    </div>
  </div>
</template>
