<script setup>
// Provider LLM locale (Ollama o LM Studio) — nessun account, nessuna quota, offline.
// Supporta URL custom (host:porta) per server remoti OpenAI-compatibili o porte non standard.
import { ref, onMounted, watch } from 'vue';
import { api } from '../../services/api.js';

const props = defineProps({ routerDati: { type: Object, default: null } });
const emit = defineEmits(['refresh']);

const attivo = ref(null);
const nome = ref(null);
const urlRilevato = ref(null);
const modelli = ref([]);
const messaggio = ref('');

const urlCustom = ref('');
const salvandoUrl = ref(false);
const messaggioUrl = ref('');

watch(() => props.routerDati, (dati) => {
  if (!dati) return;
  attivo.value = dati.locale.attivo;
  nome.value = dati.locale.nome;
  urlRilevato.value = dati.locale.url;
  modelli.value = dati.locale.modelli || [];
  urlCustom.value = dati.locale.urlCustom || '';
}, { immediate: true });

onMounted(async () => {
  try {
    const dati = await api.getOAuthConfig();
    urlCustom.value = dati.llmLocaleUrl || '';
  } catch { /* silenzioso */ }
});

async function salvaUrl() {
  salvandoUrl.value = true;
  messaggioUrl.value = '';
  try {
    await api.saveOAuthConfig({ llmLocaleUrl: urlCustom.value.trim() });
    messaggioUrl.value = urlCustom.value.trim()
      ? 'URL salvato. Ricarica lo stato per verificare la connessione.'
      : 'URL custom rimosso — rilevazione automatica riattivata.';
  } catch (err) {
    messaggioUrl.value = `Errore: ${err.message}`;
  } finally {
    salvandoUrl.value = false;
  }
}

</script>

<template>
  <div>
    <p class="note-legal">
      <strong>LLM locale</strong> (Ollama o LM Studio) — modello AI che gira direttamente sul tuo computer,
      senza connessione internet, senza account, senza quota. Più lento e meno preciso dei servizi cloud,
      ma <strong>sempre disponibile</strong> finché il server è avviato. Ultimo slot del router AI.
    </p>

    <!-- ── Stato ── -->
    <div class="card" style="margin-top:16px">
      <div class="card-head"><h2>Stato</h2></div>
      <div class="card-body">
        <div v-if="attivo === null" class="note-legal">Clicca "Verifica stato" per controllare.</div>
        <div v-else style="display:flex;flex-direction:column;gap:6px">
          <div style="display:flex;align-items:center;gap:8px">
            <span class="dot-stato" :class="{ attivo: attivo, errore: !attivo }"></span>
            <span v-if="attivo">{{ nome }} attivo su <code>{{ urlRilevato }}</code></span>
            <span v-else>Nessun server LLM rilevato</span>
          </div>
          <div v-if="modelli.length" style="font-size:.85rem;color:var(--muted)">
            Modelli: {{ modelli.join(', ') }}
          </div>
        </div>
        <div style="margin-top:12px">
          <button class="btn" @click="emit('refresh')">Verifica stato</button>
        </div>
        <span class="badge-mono" v-if="messaggio" style="display:inline-block;margin-top:8px">{{ messaggio }}</span>
      </div>
    </div>

    <!-- ── URL custom ── -->
    <div class="card" style="margin-top:16px">
      <div class="card-head"><h2>URL server (opzionale)</h2></div>
      <div class="card-body">
        <p class="note-legal">
          Lascia vuoto per la rilevazione automatica (Ollama su <code>localhost:11434</code>,
          LM Studio su <code>localhost:1234</code>). Imposta un URL per usare una porta diversa
          o un server remoto OpenAI-compatibile.
        </p>
        <div class="form-grid" style="margin-top:12px">
          <div class="field full">
            <label>URL base del server</label>
            <input type="text" v-model="urlCustom"
              placeholder="es. http://localhost:8080 oppure http://192.168.1.10:11434">
          </div>
        </div>
        <div style="margin-top:10px;display:flex;align-items:center;gap:12px">
          <button class="btn btn-primary" :disabled="salvandoUrl" @click="salvaUrl">
            {{ salvandoUrl ? 'Salvo…' : 'Salva URL' }}
          </button>
          <button class="btn" v-if="urlCustom" :disabled="salvandoUrl" @click="urlCustom = ''; salvaUrl()">
            Rimuovi (torna ad auto)
          </button>
          <span class="badge-mono" v-if="messaggioUrl">{{ messaggioUrl }}</span>
        </div>
      </div>
    </div>

    <!-- ── Setup guide ── -->
    <div class="card" style="margin-top:16px">
      <div class="card-head"><h2>Come configurare un LLM locale</h2></div>
      <div class="card-body">
        <p class="note-legal" style="margin-bottom:12px">Scegli uno dei due strumenti gratuiti:</p>
        <div style="display:flex;flex-direction:column;gap:16px;font-size:.88rem;line-height:1.6">
          <div>
            <strong>Ollama</strong> (terminale, leggero)
            <ol style="margin:6px 0 0;padding-left:20px;display:flex;flex-direction:column;gap:6px">
              <li>Scarica da <strong>ollama.ai</strong> e installa.</li>
              <li>Scarica un modello: <code>ollama pull llama3.2:3b</code> (circa 2 GB, adatto per 8+ GB RAM).</li>
              <li>Avvia il server: <code>ollama serve</code> — rimane attivo in background.</li>
            </ol>
          </div>
          <div>
            <strong>LM Studio</strong> (interfaccia grafica)
            <ol style="margin:6px 0 0;padding-left:20px;display:flex;flex-direction:column;gap:6px">
              <li>Scarica da <strong>lmstudio.ai</strong> e installa.</li>
              <li>Cerca e scarica un modello dalla schermata principale (es. <em>Phi-3 Mini</em> o <em>Llama 3.2</em>).</li>
              <li>Vai in <strong>Local Server</strong> e clicca <strong>Start Server</strong>.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dot-stato {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--muted);
  flex-shrink: 0;
}
.dot-stato.attivo { background: var(--ok); }
.dot-stato.errore { background: var(--danger, #e74c3c); }
</style>
