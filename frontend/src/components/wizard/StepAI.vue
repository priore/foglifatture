<script setup>
// Router AI a 5 provider con fallback automatico. Tab per ciascun provider nell'ordine
// della catena: Gemini (API key + CLI OAuth) → GitHub Copilot (CLI OAuth) →
// Claude (API key) → Groq (API key) → LLM locale (offline).
// Lo stato AI non viene caricato al mount: l'utente clicca "Verifica stato" quando vuole.
import { ref, onMounted } from 'vue';
import { api } from '../../services/api.js';
import StepGeminiAI from './StepGeminiAI.vue';
import StepCopilotAI from './StepCopilotAI.vue';
import StepClaudeAI from './StepClaudeAI.vue';
import StepGroqAI from './StepGroqAI.vue';
import StepLocaleLLM from './StepLocaleLLM.vue';

// Mappa scheda → provider interni del router (uno per scheda tranne Gemini che ne ha due)
const PROVIDER_PER_SCHEDA = {
  gemini:  ['gemini-api', 'agy-cli'],
  copilot: ['gh-copilot'],
  claude:  ['claude-api'],
  groq:    ['groq-api'],
  locale:  ['llm-locale'],
};

const schedaAttiva = ref('gemini');

const geminiOk = ref(false);
const copilotOk = ref(false);
const claudeConfigurato = ref(false);
const groqConfigurato = ref(false);
const localeAttivo = ref(false);

const routerDati = ref(null);
const verificando = ref(false);
const messaggioVerifica = ref('');

// Set dei provider disabilitati — caricato al mount, aggiornato ad ogni toggle
const disabilitati = ref(new Set());

onMounted(async () => {
  try {
    const oauthDati = await api.getOAuthConfig();
    claudeConfigurato.value = oauthDati.claudeApiKeyImpostata;
    groqConfigurato.value = oauthDati.groqApiKeyImpostata;
    disabilitati.value = new Set(oauthDati.aiProviderDisabilitati || []);
  } catch { /* silenzioso */ }
});

function schedaAbilitata(scheda) {
  return PROVIDER_PER_SCHEDA[scheda].some((p) => !disabilitati.value.has(p));
}

async function toggleScheda(scheda) {
  const provider = PROVIDER_PER_SCHEDA[scheda];
  const tuttiDisabilitati = provider.every((p) => disabilitati.value.has(p));
  const nuoviDis = new Set(disabilitati.value);
  if (tuttiDisabilitati) {
    provider.forEach((p) => nuoviDis.delete(p));
  } else {
    provider.forEach((p) => nuoviDis.add(p));
  }
  disabilitati.value = nuoviDis;
  await api.saveOAuthConfig({ aiProviderDisabilitati: [...nuoviDis] });
}

async function verificaStato() {
  verificando.value = true;
  messaggioVerifica.value = '';
  try {
    const [oauthDati, dati] = await Promise.all([
      api.getOAuthConfig(),
      api.aiRouterStato(),
    ]);
    routerDati.value = dati;
    geminiOk.value = oauthDati.geminiApiKeyImpostata || dati.agy.autenticato === true;
    claudeConfigurato.value = oauthDati.claudeApiKeyImpostata;
    groqConfigurato.value = oauthDati.groqApiKeyImpostata;
    copilotOk.value = dati.copilot.autenticato === true;
    localeAttivo.value = dati.locale.attivo;
    disabilitati.value = new Set(oauthDati.aiProviderDisabilitati || []);
  } catch (err) {
    messaggioVerifica.value = `Errore: ${err.message}`;
  } finally {
    verificando.value = false;
  }
}
</script>

<template>
  <div>
    <p class="note-legal" style="margin-bottom:12px">
      Il sistema AI usa una catena di fallback automatica: se un provider è esaurito o non configurato,
      passa al successivo senza interrompere l'operazione. Configura almeno uno dei provider gratuiti
      (Gemini o GitHub Copilot) per avere l'AI sempre disponibile senza costi.
    </p>

    <div class="tab-row">
      <button class="tab-btn" :class="{ attiva: schedaAttiva === 'gemini' }" @click="schedaAttiva = 'gemini'">
        <span class="dot-stato" :class="{ attivo: geminiOk }"></span>Gemini
        <span class="tab-badge free">gratuito</span>
      </button>
      <button class="tab-btn" :class="{ attiva: schedaAttiva === 'copilot' }" @click="schedaAttiva = 'copilot'">
        <span class="dot-stato" :class="{ attivo: copilotOk }"></span>GitHub Copilot
        <span class="tab-badge free">gratuito</span>
      </button>
      <button class="tab-btn" :class="{ attiva: schedaAttiva === 'claude' }" @click="schedaAttiva = 'claude'">
        <span class="dot-stato" :class="{ attivo: claudeConfigurato }"></span>Claude
        <span class="tab-badge">API key</span>
      </button>
      <button class="tab-btn" :class="{ attiva: schedaAttiva === 'groq' }" @click="schedaAttiva = 'groq'">
        <span class="dot-stato" :class="{ attivo: groqConfigurato }"></span>Groq
        <span class="tab-badge">API key</span>
      </button>
      <button class="tab-btn" :class="{ attiva: schedaAttiva === 'locale' }" @click="schedaAttiva = 'locale'">
        <span class="dot-stato" :class="{ attivo: localeAttivo }"></span>LLM locale
        <span class="tab-badge free">offline</span>
      </button>
    </div>

    <div style="margin-top:20px">
      <div style="margin-bottom:14px;display:flex;align-items:center;gap:10px">
        <input class="checkbox-app" type="checkbox"
          :id="`ai-abilitato-${schedaAttiva}`"
          :checked="schedaAbilitata(schedaAttiva)"
          @change="toggleScheda(schedaAttiva)">
        <label :for="`ai-abilitato-${schedaAttiva}`" style="cursor:pointer;font-size:.9rem">
          Provider abilitato nel router AI
        </label>
      </div>
      <StepGeminiAI v-if="schedaAttiva === 'gemini'" :router-dati="routerDati" @refresh="verificaStato" />
      <StepCopilotAI v-else-if="schedaAttiva === 'copilot'" :router-dati="routerDati" @refresh="verificaStato" />
      <StepClaudeAI v-else-if="schedaAttiva === 'claude'" />
      <StepGroqAI v-else-if="schedaAttiva === 'groq'" />
      <StepLocaleLLM v-else :router-dati="routerDati" @refresh="verificaStato" />
    </div>
  </div>
</template>

<style scoped>
.tab-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: var(--radius, 8px);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  cursor: pointer;
  font-size: .88rem;
  transition: background .15s, border-color .15s;
}
.tab-btn:hover { background: var(--surface-raised, rgba(255,255,255,.06)); }
.tab-btn.attiva {
  background: var(--primary, #3b82f6);
  border-color: var(--primary, #3b82f6);
  color: #fff;
}

.dot-stato {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--muted);
  flex-shrink: 0;
}
.dot-stato.attivo { background: var(--ok); }

.tab-badge {
  font-size: .72rem;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--surface-raised, rgba(255,255,255,.1));
  color: var(--muted);
  white-space: nowrap;
}
.tab-badge.free { color: var(--ok); }
</style>
