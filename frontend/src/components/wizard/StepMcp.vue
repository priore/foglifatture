<script setup>
import { chiediConferma } from '../../composables/useConferma.js';
// Server MCP in sola lettura (FP-008). Salva da sé: toggle e token passano da /api/mcp, non da config.json generico.
import { ref, computed, onMounted } from 'vue';
import { api } from '../../services/api.js';

const stato = ref(null);
const errore = ref('');
const copiato = ref('');

onMounted(async () => {
  try {
    stato.value = await api.statoMcp();
  } catch (err) {
    errore.value = err.message;
  }
});

async function cambiaAbilitato() {
  try {
    stato.value = await api.impostaMcpAbilitato(!stato.value.abilitato);
  } catch (err) {
    errore.value = err.message;
  }
}

async function rigenera() {
  if (!(await chiediConferma('Il vecchio token smette di funzionare: i client già configurati vanno aggiornati. Continuare?', { titolo: 'Rigenera token', ok: 'Rigenera' }))) return;
  try {
    stato.value = await api.rigeneraTokenMcp();
  } catch (err) {
    errore.value = err.message;
  }
}

const jsonDesktop = computed(() => JSON.stringify({
  mcpServers: { timesheet: { command: stato.value.comandoNode, args: [stato.value.percorsoStdio] } },
}, null, 2));
const comandoClaudeCode = computed(() => `claude mcp add timesheet -- "${stato.value.comandoNode}" "${stato.value.percorsoStdio}"`);

async function copia(chiave, testo) {
  try {
    await navigator.clipboard.writeText(testo);
    copiato.value = chiave;
    setTimeout(() => (copiato.value = ''), 1500);
  } catch {
    errore.value = 'Copia non riuscita: seleziona il testo e copia manualmente';
  }
}
</script>

<template>
  <div v-if="stato">
    <div style="display:flex;align-items:center;gap:8px">
      <input id="mcp-abilitato" type="checkbox" class="checkbox-app" :checked="stato.abilitato" @change="cambiaAbilitato">
      <label for="mcp-abilitato" style="margin:0">Abilita server MCP (sola lettura)</label>
    </div>
    <small class="note-legal" style="margin-top:6px;display:block">
      Dati aggregati su versamenti e fatture leggibili dal tuo client AI. Anagrafica, codice fiscale, IBAN e segreti non vengono mai esposti;
      il server non può emettere fatture, modificare impostazioni, avviare backup o inviare PEC.
    </small>

    <template v-if="stato.abilitato">
      <h4 class="mcp-titolo">Claude Desktop</h4>
      <small class="note-legal mcp-nota">Incolla in <code>claude_desktop_config.json</code> e riavvia Claude Desktop.</small>
      <textarea class="mcp-code" readonly rows="8" :value="jsonDesktop"></textarea>
      <button class="btn btn-ghost" @click="copia('desktop', jsonDesktop)">{{ copiato === 'desktop' ? 'Copiato' : 'Copia JSON' }}</button>

      <h4 class="mcp-titolo">Claude Code</h4>
      <textarea class="mcp-code" readonly rows="2" :value="comandoClaudeCode"></textarea>
      <button class="btn btn-ghost" @click="copia('code', comandoClaudeCode)">{{ copiato === 'code' ? 'Copiato' : 'Copia comando' }}</button>

      <h4 class="mcp-titolo">ChatGPT, Gemini e altri client HTTP</h4>
      <small class="note-legal mcp-nota">Il token equivale a una password: non condividerlo.</small>
      <textarea class="mcp-code" readonly rows="2" :value="stato.urlHttp"></textarea>
      <button class="btn btn-ghost" @click="copia('http', stato.urlHttp)">{{ copiato === 'http' ? 'Copiato' : 'Copia URL' }}</button>
      <button class="btn btn-ghost" @click="rigenera">Rigenera token</button>
    </template>

    <small v-if="errore" class="note-legal mcp-nota">{{ errore }}</small>
  </div>
</template>

<style scoped>
.mcp-titolo { margin: 16px 0 6px; font-size: var(--font-size-base); }
.mcp-nota { display: block; margin-bottom: 6px; }
.mcp-code {
  width: 100%;
  display: block;
  font-family: 'IBM Plex Mono', monospace;
  font-size: var(--font-size-sm);
}
</style>
