<script setup>
// Configurazione API key per le funzioni assistite da AI (free tier), tre sotto-schede:
// Gemini (primario, con ricerca web per ATECO/scadenze fiscali), Claude (secondo fallback) e
// Groq (ultimo fallback) — entrambi usati automaticamente solo per mapping colonne CSV
// pagamenti e scadenze fiscali quando la quota Gemini è esaurita (vedi
// pagamentiFattureService.js/scadenzeFiscaliService.js). Come "Google", questi dati vivono in
// backend/.env (nome modello) + Keychain OS (API key), non in config.json.
import { ref, onMounted } from 'vue';
import { api } from '../../services/api.js';
import StepGeminiAI from './StepGeminiAI.vue';
import StepClaudeAI from './StepClaudeAI.vue';
import StepGroqAI from './StepGroqAI.vue';

const schedaAttiva = ref('gemini');
const geminiConfigurato = ref(false);
const claudeConfigurato = ref(false);
const groqConfigurato = ref(false);

onMounted(async () => {
  const dati = await api.getOAuthConfig();
  geminiConfigurato.value = dati.geminiApiKeyImpostata;
  claudeConfigurato.value = dati.claudeApiKeyImpostata;
  groqConfigurato.value = dati.groqApiKeyImpostata;
});
</script>

<template>
  <div>
    <div class="btn-group" style="margin-bottom:20px;display:flex;gap:8px">
      <button class="btn" :class="{ 'btn-primary': schedaAttiva === 'gemini' }" @click="schedaAttiva = 'gemini'">
        <span class="dot-stato" :class="{ attivo: geminiConfigurato }"></span>Gemini AI
      </button>
      <button class="btn" :class="{ 'btn-primary': schedaAttiva === 'claude' }" @click="schedaAttiva = 'claude'">
        <span class="dot-stato" :class="{ attivo: claudeConfigurato }"></span>Claude AI
      </button>
      <button class="btn" :class="{ 'btn-primary': schedaAttiva === 'groq' }" @click="schedaAttiva = 'groq'">
        <span class="dot-stato" :class="{ attivo: groqConfigurato }"></span>Groq AI
      </button>
    </div>

    <StepGeminiAI v-if="schedaAttiva === 'gemini'" />
    <StepClaudeAI v-else-if="schedaAttiva === 'claude'" />
    <StepGroqAI v-else />
  </div>
</template>

<style scoped>
.dot-stato {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
  background: var(--muted);
}
.dot-stato.attivo { background: var(--ok); }
</style>
