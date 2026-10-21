<script setup>
// Configurazione Gemini: due canali di accesso in parallelo.
// 1. API key (aistudio.google.com) — richiede registrazione, modello configurabile.
// 2. agy CLI (Google Antigravity) — OAuth Google gratuito, nessuna API key, login via browser.
// Il router AI tenta prima la API key (se configurata), poi il CLI.
import { ref, onMounted, watch } from 'vue';
import { api } from '../../services/api.js';

const props = defineProps({ routerDati: { type: Object, default: null } });
const emit = defineEmits(['refresh']);

const geminiApiKey = ref('');
const geminiApiKeyImpostata = ref(false);
const messaggioGemini = ref('');
const salvandoGemini = ref(false);

const modelliDisponibili = ref([]);
const modelloScelto = ref('');
const caricandoModelli = ref(false);
const verificandoModello = ref(false);
const messaggioModello = ref('');

// Stato CLI OAuth (agy) — derivato dalla prop routerDati
const agyInstallato = ref(null);
const agyAutenticato = ref(null);
const avviandoLoginCli = ref(false);
const messaggioCli = ref('');

watch(() => props.routerDati, (dati) => {
  if (!dati) return;
  agyInstallato.value = dati.agy.installato;
  agyAutenticato.value = dati.agy.autenticato;
}, { immediate: true });

onMounted(async () => {
  const oauthDati = await api.getOAuthConfig();
  geminiApiKeyImpostata.value = oauthDati.geminiApiKeyImpostata;
  modelloScelto.value = oauthDati.geminiModello || '';
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
      geminiApiKey: geminiApiKey.value,
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

function ricaricaStatoCli() {
  emit('refresh');
}

async function avviaLoginCli() {
  avviandoLoginCli.value = true;
  messaggioCli.value = '';
  try {
    const r = await api.aiRouterLogin('agy');
    messaggioCli.value = r.messaggio;
  } catch (err) {
    messaggioCli.value = `Errore: ${err.message}`;
  } finally {
    avviandoLoginCli.value = false;
  }
}
</script>

<template>
  <div>
    <p class="note-legal">
      Gemini è il provider AI primario. Puoi usarlo tramite <strong>API key</strong> (piano gratuito su
      AI Studio, modello configurabile) o tramite <strong>login Google</strong> senza API key (canale CLI
      gratuito). Il router tenta prima la API key se configurata, poi il CLI.
    </p>

    <!-- ── Canale 1: API key ── -->
    <div class="card" style="margin-top:16px">
      <div class="card-head">
        <h2>
          <span class="dot-stato" :class="{ attivo: geminiApiKeyImpostata }"></span>
          API key
        </h2>
      </div>
      <div class="card-body">
        <div class="form-grid">
          <div class="field full">
            <label>Gemini API Key {{ geminiApiKeyImpostata ? '(già impostata — lascia vuoto per non cambiarla)' : '' }}</label>
            <input type="password" v-model="geminiApiKey" :placeholder="geminiApiKeyImpostata ? '••••••••' : ''">
          </div>
        </div>
        <div style="margin-top:12px;display:flex;align-items:center;gap:12px">
          <button class="btn btn-ok" :disabled="salvandoGemini" @click="salvaGemini">{{ salvandoGemini ? 'Salvo…' : 'Salva API key' }}</button>
          <span class="badge-mono" v-if="messaggioGemini">{{ messaggioGemini }}</span>
        </div>

        <div style="margin-top:16px">
          <p class="note-legal" style="margin-bottom:8px">
            Scegli tra i modelli disponibili per la tua API key e verificalo con una chiamata di prova.
          </p>
          <div class="form-grid">
            <div class="field full" style="display:flex;align-items:center;gap:12px">
              <select v-model="modelloScelto" style="flex:1">
                <option value="" disabled>{{ modelliDisponibili.length ? 'Seleziona un modello' : 'Carica l\'elenco modelli' }}</option>
                <option v-if="modelloScelto && !modelliDisponibili.includes(modelloScelto)" :value="modelloScelto">{{ modelloScelto }}</option>
                <option v-for="m in modelliDisponibili" :key="m" :value="m">{{ m }}</option>
              </select>
              <button class="btn btn-ghost" :disabled="caricandoModelli" @click="caricaModelli">{{ caricandoModelli ? 'Carico…' : 'Carica elenco' }}</button>
              <button class="btn btn-ok" :disabled="!modelloScelto || verificandoModello" @click="verificaModello">{{ verificandoModello ? 'Verifico…' : 'Verifica e salva' }}</button>
            </div>
          </div>
          <span class="badge-mono" v-if="messaggioModello" style="display:inline-block;margin-top:8px">{{ messaggioModello }}</span>
        </div>

        <div class="note-legal" style="margin-top:14px;font-size:.83rem">
          Per ottenere una API key: vai su <strong>aistudio.google.com/apikey</strong>, accedi con Google,
          clicca <strong>Create API key</strong> e incolla qui sopra.
        </div>
      </div>
    </div>

    <!-- ── Canale 2: CLI OAuth (agy) ── -->
    <div class="card" style="margin-top:16px">
      <div class="card-head">
        <h2>
          <span class="dot-stato" :class="{ attivo: agyAutenticato === true, errore: agyAutenticato === false && agyInstallato }"></span>
          Login Google (gratuito, senza API key)
        </h2>
      </div>
      <div class="card-body">
        <p class="note-legal">
          Accesso gratuito a Gemini tramite il tuo account Google, senza API key né limiti di registrazione.
          Richiede <strong>Google Antigravity CLI</strong> installato e un login iniziale via browser.
          Non supporta ricerca web: usato per mapping CSV, spiegazioni, e altri compiti senza grounding.
        </p>

        <div v-if="agyInstallato !== null" style="margin-top:12px;display:flex;flex-direction:column;gap:6px">
          <div style="display:flex;align-items:center;gap:8px;font-size:.9rem">
            <span class="dot-stato" :class="{ attivo: agyInstallato, errore: !agyInstallato }"></span>
            <span>{{ agyInstallato ? 'Google Antigravity CLI installato' : 'Google Antigravity CLI non trovato nel PATH' }}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;font-size:.9rem">
            <span class="dot-stato" :class="{ attivo: agyAutenticato === true, errore: agyAutenticato === false, sconosciuto: agyAutenticato === null }"></span>
            <span>
              <template v-if="agyAutenticato === true">Login Google attivo</template>
              <template v-else-if="agyAutenticato === false">Login non effettuato</template>
              <template v-else-if="agyAutenticato === null">Stato login non determinabile</template>
            </span>
          </div>
        </div>

        <div style="margin-top:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <button class="btn btn-ghost" @click="ricaricaStatoCli">Verifica stato</button>
          <button class="btn btn-primary"
            :disabled="avviandoLoginCli"
            @click="avviaLoginCli">
            {{ avviandoLoginCli ? 'Apertura browser…' : 'Accedi con Google' }}
          </button>
        </div>
        <div v-if="messaggioCli" style="margin-top:10px;padding:10px 14px;border-radius:var(--radius,8px);background:var(--surface-raised,rgba(255,255,255,.06));font-size:.88rem;line-height:1.5">
          {{ messaggioCli }}
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.dot-stato {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--muted);
  flex-shrink: 0;
  margin-right: 4px;
}
.dot-stato.attivo { background: var(--ok); }
.dot-stato.errore { background: var(--danger, #e74c3c); }
.dot-stato.sconosciuto { background: var(--warning, #f39c12); }
</style>
