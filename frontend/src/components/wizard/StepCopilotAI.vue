<script setup>
import { ref, watch } from 'vue';
import { api } from '../../services/api.js';

const props = defineProps({ routerDati: { type: Object, default: null } });
const emit = defineEmits(['refresh']);

const installato = ref(null);
const autenticato = ref(null);
const avviandoLogin = ref(false);
const errore = ref('');

// Modale OTP
const otpVisibile = ref(false);
const otpCodice = ref('');

watch(() => props.routerDati, (dati) => {
  if (!dati) return;
  installato.value = dati.copilot.installato;
  autenticato.value = dati.copilot.autenticato;
}, { immediate: true });

async function avviaLogin() {
  avviandoLogin.value = true;
  errore.value = '';
  otpVisibile.value = false;
  try {
    const r = await api.aiRouterLogin('copilot');
    // Estrai codice OTP dal messaggio (formato: "Codice: XXXX-XXXX")
    const match = r.messaggio.match(/Codice[:\s]+([A-Z0-9]{4}-[A-Z0-9]{4})/i);
    if (match) {
      otpCodice.value = match[1];
      otpVisibile.value = true;
    } else {
      errore.value = r.messaggio;
    }
  } catch (err) {
    errore.value = `Errore: ${err.message}`;
  } finally {
    avviandoLogin.value = false;
  }
}

function chiudiOtp() {
  otpVisibile.value = false;
  emit('refresh');
}
</script>

<template>
  <div>
    <p class="note-legal">
      <strong>GitHub Copilot CLI</strong> (<code>gh copilot</code>) — accesso gratuito tramite il tuo account GitHub
      (piano Free include 50 interazioni chat/mese). Secondo slot del router AI dopo Google Antigravity CLI.
      Non supporta ricerca web: usato per mapping CSV, spiegazioni fiscali, e altri compiti testuali.
    </p>

    <div class="card" style="margin-top:16px">
      <div class="card-head"><h2>Stato</h2></div>
      <div class="card-body">
        <div v-if="installato === null" class="note-legal">Clicca "Verifica stato" per controllare.</div>
        <div v-else style="display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;align-items:center;gap:8px">
            <span class="dot-stato" :class="{ attivo: installato, errore: installato === false }"></span>
            <span>{{ installato ? 'GitHub CLI installato' : 'GitHub CLI (gh) non trovato nel PATH' }}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="dot-stato" :class="{ attivo: autenticato === true, errore: autenticato === false }"></span>
            <span>{{ autenticato === true ? 'Login GitHub attivo — Copilot funzionante' : 'Login non effettuato' }}</span>
          </div>
        </div>

        <div style="margin-top:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <button class="btn" @click="emit('refresh')">Verifica stato</button>
          <button class="btn btn-primary" :disabled="avviandoLogin" @click="avviaLogin">
            {{ avviandoLogin ? 'Apertura browser…' : 'Accedi con GitHub' }}
          </button>
        </div>
        <div v-if="errore" class="note-legal" style="margin-top:10px;color:var(--danger,#e74c3c)">{{ errore }}</div>
      </div>
    </div>

    <!-- Modale OTP -->
    <div v-if="otpVisibile" class="otp-overlay" @click.self="chiudiOtp">
      <div class="otp-modal">
        <h3 style="margin:0 0 8px">Codice di autorizzazione GitHub</h3>
        <p class="note-legal" style="margin:0 0 20px">
          Inserisci questo codice nella pagina GitHub aperta nel browser:
        </p>
        <div class="otp-codice">{{ otpCodice }}</div>
        <p class="note-legal" style="margin:16px 0 20px;font-size:.83rem">
          Dopo aver completato il login nel browser, clicca "Ho completato il login".
        </p>
        <div style="display:flex;gap:10px;justify-content:center">
          <button class="btn btn-primary" @click="chiudiOtp">Ho completato il login</button>
          <button class="btn" @click="otpVisibile = false">Chiudi</button>
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

.otp-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.otp-modal {
  background: var(--surface, #1e1e2e);
  border: 1px solid var(--border);
  border-radius: var(--radius, 12px);
  padding: 32px;
  max-width: 480px;
  width: 90%;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0,0,0,.4);
}

.otp-codice {
  font-size: 2rem;
  white-space: nowrap;
  font-weight: 700;
  letter-spacing: .25em;
  font-family: monospace;
  color: var(--primary, #3b82f6);
  background: var(--surface-raised, rgba(255,255,255,.06));
  border-radius: 8px;
  padding: 16px 24px;
  display: inline-block;
  user-select: all;
}
</style>
