<script setup>
// FP-009: chat AI in sola lettura sui dati dell'app (stessi tool dell'MCP, nessuna scrittura).
import { ref, nextTick } from 'vue';
import { api } from '../services/api.js';

const SUGGERIMENTI = [
  'Quanto ho incassato quest\'anno e a che punto sono con la soglia?',
  'Quali fatture sono ancora da incassare?',
  'Ho F24 in scadenza prossimamente?',
  'Quanto bollo devo versare nel prossimo trimestre?',
];

const messaggi = ref([]);
const domanda = ref('');
const inCorso = ref(false);
const errore = ref('');
const chiediConsenso = ref(false);
const elenco = ref(null);

async function scorriInFondo() {
  await nextTick();
  if (elenco.value) elenco.value.scrollTop = elenco.value.scrollHeight;
}

async function invia(consenso = {}) {
  errore.value = '';
  chiediConsenso.value = false;
  if (!consenso.conferma) {
    const testo = domanda.value.trim();
    if (!testo || inCorso.value) return;
    messaggi.value.push({ ruolo: 'utente', testo });
    domanda.value = '';
  }
  inCorso.value = true;
  scorriInFondo();
  try {
    const r = await api.chatAi({ messaggi: messaggi.value, ...consenso });
    messaggi.value.push({ ruolo: 'assistente', testo: r.risposta, strumenti: r.strumenti });
  } catch (err) {
    if (err.codice === 'AUTORIZZAZIONE_RICHIESTA') chiediConsenso.value = true;
    else errore.value = err.message;
  } finally {
    inCorso.value = false;
    scorriInFondo();
  }
}

function usaSuggerimento(testo) {
  domanda.value = testo;
  invia();
}

function svuota() {
  messaggi.value = [];
  errore.value = '';
}
</script>

<template>
  <div class="card chat-ai">
    <div class="card-head">
      <span class="card-head-titolo"><h2>Assistente AI</h2></span>
      <button v-if="messaggi.length" type="button" class="btn btn-ghost" @click="svuota">Nuova conversazione</button>
    </div>
    <div class="card-body">
      <p class="note-legal">Interroga i tuoi dati in linguaggio naturale. L'assistente legge soltanto: non emette fatture, non modifica dati e non invia nulla. Anagrafica, codice fiscale, IBAN e credenziali non sono accessibili. Le risposte sono indicative, non consulenza fiscale.</p>

      <div ref="elenco" class="chat-messaggi" aria-live="polite">
        <div v-for="(m, i) in messaggi" :key="i" :class="['chat-msg', m.ruolo === 'utente' ? 'chat-msg-utente' : 'chat-msg-ai']">
          <span class="chat-testo">{{ m.testo }}</span>
          <span v-if="m.strumenti?.length" class="chat-fonti">Dati letti: {{ [...new Set(m.strumenti)].join(', ') }}</span>
        </div>
        <div v-if="inCorso" class="chat-msg chat-msg-ai chat-attesa">…</div>
      </div>

      <p v-if="errore" class="chat-errore" role="alert">{{ errore }}</p>

      <p v-if="!messaggi.length" class="chat-vuoto chat-guida">Scrivi una domanda o scegli un suggerimento qui sotto.</p>

      <form class="chat-form" @submit.prevent="invia()">
        <input v-model="domanda" type="text" class="chat-input" maxlength="500" placeholder="Es. quali fatture devo ancora incassare?" aria-label="Domanda all'assistente" :disabled="inCorso" />
        <button type="submit" class="btn btn-primary" :disabled="inCorso || !domanda.trim()">Invia</button>
      </form>

      <div class="chat-suggerimenti" aria-label="Domande suggerite">
        <button v-for="s in SUGGERIMENTI" :key="s" type="button" class="chat-suggerimento" :disabled="inCorso" @click="usaSuggerimento(s)">{{ s }}</button>
      </div>
    </div>

    <div v-if="chiediConsenso" class="modal-overlay" @click.self="chiediConsenso = false">
      <div class="modal-box" role="dialog" aria-modal="true">
        <h2>Inviare i dati all'AI?</h2>
        <p class="note-legal">Per rispondere, l'assistente invia al provider AI configurato i dati fiscali che servono alla domanda (importi, fatture, scadenze F24, bollo, crediti). Anagrafica, codice fiscale, IBAN e credenziali non vengono mai inviati.</p>
        <div class="modal-actions">
          <button type="button" class="btn btn-ok" @click="invia({ conferma: true })">Sì, questa volta</button>
          <button type="button" class="btn btn-ghost" @click="invia({ conferma: true, ricorda: true })">Sì, sempre</button>
          <button type="button" class="btn btn-warn" @click="chiediConsenso = false">Annulla</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-messaggi { display: flex; flex-direction: column; gap: var(--gap-sm); min-height: 220px; max-height: 55vh; overflow-y: auto; margin: 14px 0; }
.chat-vuoto { margin: 0; color: var(--muted); font-size: var(--font-size-sm); }
.chat-guida { margin-bottom: var(--gap-sm); }
.chat-suggerimenti { display: flex; flex-wrap: wrap; gap: var(--gap-sm); margin-top: var(--gap-md); }
.chat-suggerimento { border: 1px solid var(--ok); background: var(--ok-bg); color: var(--ok); border-radius: var(--radius-pill); padding: 5px 12px; font-size: var(--font-size-sm); font-weight: 600; cursor: pointer; text-align: left; }
.chat-suggerimento:hover:not(:disabled) { background: color-mix(in srgb, var(--ok) 22%, var(--ok-bg)); }
.chat-suggerimento:disabled { opacity: .5; cursor: default; }
.chat-msg { display: flex; flex-direction: column; gap: 4px; max-width: 85%; padding: 8px 12px; border-radius: var(--radius-lg); font-size: var(--font-size-base); line-height: 1.5; white-space: pre-wrap; }
.chat-msg-utente { align-self: flex-end; background: var(--accent); color: var(--accent-ink); }
.chat-msg-ai { align-self: flex-start; background: var(--ground); border: 1px solid var(--line); color: var(--ink); }
.chat-fonti { font-size: var(--font-size-2xs); color: var(--muted); }
.chat-attesa { color: var(--muted); }
.chat-errore { color: var(--warn); background: var(--warn-bg); border-radius: var(--radius-sm); padding: 6px 10px; font-size: var(--font-size-sm); }
.chat-form { display: flex; gap: var(--gap-sm); }
.chat-input { flex: 1; border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 8px 10px; font-size: var(--font-size-base); background: var(--card); color: var(--ink); }
</style>
