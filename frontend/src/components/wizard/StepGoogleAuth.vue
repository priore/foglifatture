<script setup>
// Configurazione del login Google OAuth (whitelist di una sola email).
// A differenza degli altri step, questi dati vivono in backend/.env (non in
// config.json) perché sono credenziali di avvio server: servono al processo
// fin dal boot, prima ancora che l'app carichi qualunque configurazione JSON.
import { ref, onMounted } from 'vue';
import { api } from '../../services/api.js';

const clientId = ref('');
const clientSecret = ref('');
const allowedEmail = ref('');
const secretGiaImpostato = ref(false);
const autenticazioneAttiva = ref(false);
const messaggio = ref('');
const salvando = ref(false);
const serveRiavvio = ref(false);
const riavviando = ref(false);

onMounted(async () => {
  const dati = await api.getOAuthConfig();
  clientId.value = dati.googleClientId;
  allowedEmail.value = dati.allowedEmail;
  secretGiaImpostato.value = dati.googleClientSecretImpostato;
  autenticazioneAttiva.value = dati.autenticazioneAttiva;
});

async function salva() {
  salvando.value = true;
  messaggio.value = '';
  try {
    const risultato = await api.saveOAuthConfig({
      googleClientId: clientId.value,
      googleClientSecret: clientSecret.value, // vuoto = non modificare il secret esistente
      allowedEmail: allowedEmail.value,
    });
    messaggio.value = risultato.messaggio;
    serveRiavvio.value = risultato.messaggio.includes('Riavvia il servizio');
    if (clientSecret.value) secretGiaImpostato.value = true;
    clientSecret.value = '';
  } catch (err) {
    messaggio.value = `Errore: ${err.message}`;
  } finally {
    salvando.value = false;
  }
}

async function riavvia() {
  riavviando.value = true;
  try {
    await api.riavviaApp();
    messaggio.value = 'Riavvio in corso…';
    serveRiavvio.value = false;
  } catch (err) {
    messaggio.value = `Errore: ${err.message}`;
  } finally {
    riavviando.value = false;
  }
}

</script>

<template>
  <div>
    <h2>Login</h2>
    <p class="note-legal">
      Login con account Google, whitelist di una sola email. Redirect URI da configurare
      su <strong>Google Cloud Console</strong> (Credenziali → ID client OAuth 2.0):
      <code>http://localhost:1969/auth/google/callback</code>.
      Se lasci Client ID/Secret vuoti, il login resta disattivato e si accede direttamente
      all'app (utile per la primissima configurazione).
    </p>

    <div class="form-grid" style="margin-top:16px">
      <div class="field">
        <label>Stato attuale</label>
        <span class="badge-mono">{{ autenticazioneAttiva ? 'Login attivo' : 'Login disattivato' }}</span>
      </div>
      <div class="field"></div>

      <div class="field full">
        <label>Google Client ID</label>
        <input v-model="clientId" placeholder="xxxxxxxx.apps.googleusercontent.com">
      </div>
      <div class="field full">
        <label>Google Client Secret {{ secretGiaImpostato ? '(già impostato — lascia vuoto per non cambiarlo)' : '' }}</label>
        <input type="password" v-model="clientSecret" :placeholder="secretGiaImpostato ? '••••••••' : ''">
      </div>
      <div class="field full">
        <label>Email autorizzate all'accesso (separate da virgola)</label>
        <input v-model="allowedEmail" type="email" multiple placeholder="tuonome@gmail.com, altro@gmail.com">
      </div>
    </div>

    <div style="margin-top:16px;display:flex;align-items:center;gap:12px">
      <button class="btn btn-primary" :disabled="salvando" @click="salva">{{ salvando ? 'Salvo…' : 'Salva credenziali' }}</button>
      <button class="btn btn-warn" v-if="serveRiavvio" :disabled="riavviando" @click="riavvia">{{ riavviando ? 'Riavvio…' : 'Riavvia app' }}</button>
      <span class="badge-mono" v-if="messaggio">{{ messaggio }}</span>
    </div>

    <div class="card" style="margin-top:24px">
      <div class="card-head"><h2>Come ottenere Client ID e Client Secret</h2></div>
      <div class="card-body">
        <ol style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:10px;font-size:.88rem;line-height:1.6">
          <li>Vai su <strong>console.cloud.google.com</strong> e accedi con il tuo account Google personale.</li>
          <li>In alto a sinistra clicca il selettore progetti → <strong>Nuovo progetto</strong>. Dagli un nome a piacere (es. "Fatturazione") e crealo.</li>
          <li>Con il progetto selezionato, apri il menu ☰ → <strong>API e servizi</strong> → <strong>Schermata consenso OAuth</strong>.</li>
          <li>Scegli tipo utente <strong>Esterno</strong> → Crea. Compila nome app, la tua email come contatto, e salva/continua nelle schermate successive (scope e utenti di test si possono lasciare vuoti).</li>
          <li>Nella sezione <strong>Utenti di test</strong> aggiungi la tua email Gmail (finché l'app resta in modalità "Test" solo le email aggiunte qui possono accedere).</li>
          <li>Vai su <strong>API e servizi</strong> → <strong>Credenziali</strong> → <strong>Crea credenziali</strong> → <strong>ID client OAuth</strong>.</li>
          <li>Tipo applicazione: <strong>Applicazione web</strong>. Nome a piacere.</li>
          <li>In <strong>URI di reindirizzamento autorizzati</strong> aggiungi esattamente:
            <div class="badge-mono" style="margin-top:4px;display:inline-block">http://localhost:1969/auth/google/callback</div>
          </li>
          <li>Clicca <strong>Crea</strong>: Google mostra <strong>Client ID</strong> e <strong>Client secret</strong> in un popup. Copiali subito (il secret non sarà più visibile per intero dopo).</li>
          <li>Incollali nei campi qui sopra, insieme alla tua email Gmail in "Email autorizzata", e salva: comparirà il pulsante "Riavvia app" per applicare subito le nuove credenziali.</li>
        </ol>
      </div>
    </div>
  </div>
</template>
