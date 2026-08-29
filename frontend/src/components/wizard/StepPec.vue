<script setup>
import { computed } from 'vue';
import { pecValida } from '../../composables/useValidazioneFiscale.js';

const props = defineProps({
  modelValue: { type: Object, required: true }, // config.pec
  sdi: { type: Object, required: true }, // config.sdi
});

const casellaMittenteOk = computed(() => pecValida(props.modelValue.casellaMittente));
</script>

<template>
  <div class="form-grid">
    <div class="field"><label>Server SMTP PEC</label><input v-model="modelValue.smtpHost" placeholder="smtps.pec-provider.it"></div>
    <div class="field"><label>Porta SMTP</label><input type="number" v-model.number="modelValue.smtpPort"></div>
    <div class="field">
      <label>Casella PEC mittente</label>
      <input v-model="modelValue.casellaMittente" :class="{ 'campo-non-valido': !casellaMittenteOk }" placeholder="nome@pec.it">
      <small v-if="!casellaMittenteOk" class="nota-errore">Formato email non valido.</small>
    </div>
    <div class="field"><label>Password casella PEC</label><input type="password" v-model="modelValue.passwordMittente"></div>
    <div class="field field-full full"><label>Destinatario SDI</label><input v-model="modelValue.destinatarioSdi"></div>
  </div>
  <p class="note-legal" style="margin-top:16px">
    Il modulo di invio è predisposto ma non testato con invio reale: verifica queste credenziali con il tuo gestore PEC prima del primo invio effettivo al Sistema di Interscambio.
  </p>

  <h3 style="margin-top:24px;font-size:.95rem">Ricezione ricevute SDI (IMAP)</h3>
  <p class="note-legal">
    Stessa casella PEC sopra, usata in sola lettura per scaricare automaticamente ricevute/notifiche
    SDI (consegna, scarto, mancata consegna, esiti, fattura firmata). Nessun'altra email nella
    casella viene toccata: legge solo i messaggi da <code>@pec.fatturapa.it</code>.
  </p>
  <div class="form-grid" style="margin-top:8px">
    <div class="field field-full full" style="flex-direction:row;align-items:center;gap:8px">
      <input id="sdi-polling-abilitato" type="checkbox" v-model="sdi.pollingAbilitato" style="width:auto">
      <label for="sdi-polling-abilitato" style="margin:0">Controllo ricevute SDI attivo (automatico e ping manuale)</label>
    </div>
    <div class="field"><label>Server IMAP PEC</label><input v-model="modelValue.imapHost" placeholder="imaps.pec-provider.it" :disabled="!sdi.pollingAbilitato"></div>
    <div class="field"><label>Porta IMAP</label><input type="number" v-model.number="modelValue.imapPort" :disabled="!sdi.pollingAbilitato"></div>
    <div class="field field-full full">
      <label>Cartella archivio locale (es. una cartella dentro Dropbox)</label>
      <input v-model="sdi.percorsoArchivio" placeholder="/Users/tuonome/Dropbox/Fatture/SDI" :disabled="!sdi.pollingAbilitato">
    </div>
    <div class="field"><label>Controllo automatico ogni (minuti)</label><input type="number" min="1" v-model.number="sdi.intervalloPollingMinuti" :disabled="!sdi.pollingAbilitato"></div>
  </div>
</template>
