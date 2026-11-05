<script setup>
import { capacita } from '../../composables/useCapacita.js';
import { registro } from '../../registroEstensioni.js';
defineProps({
  modelValue: { type: Object, required: true }, // config.reminder
  notifiche: { type: Object, required: true },  // config.notifiche
});
</script>

<template>
  <div class="form-grid">
    <div class="field field-full full" style="flex-direction:row;align-items:center;gap:8px">
      <input id="notifiche-abilitate" type="checkbox" class="checkbox-app" v-model="notifiche.abilitate">
      <label for="notifiche-abilitate" style="margin:0">{{ capacita.notificheDesktop ? 'Notifiche desktop abilitate' : 'Notifiche abilitate' }}</label>
    </div>
  </div>
  <p class="note-legal" style="margin-top:8px;margin-bottom:16px">
    Abilita o disabilita tutte le notifiche (promemoria timesheet, backup, ricevute SDI,
    monitoraggio fonti normative){{ capacita.piattaforma === 'desktop' ? ' su macOS, Windows e Linux' : '' }}. Disabilitando nessuna notifica verrà mostrata.
  </p>
  <component :is="registro.avvisoNotifiche" v-if="registro.avvisoNotifiche && notifiche.abilitate" />
  <div class="form-grid">
    <div class="field field-full full" style="flex-direction:row;align-items:center;gap:8px">
      <input id="reminder-abilitato" type="checkbox" class="checkbox-app" v-model="modelValue.abilitato" :disabled="!notifiche.abilitate">
      <label for="reminder-abilitato" style="margin:0">Promemoria fine mese attivo</label>
    </div>
  </div>
  <p class="note-legal" style="margin-top:16px">
    Se attivo, solo l'ultimo giorno lavorativo del mese arriva una notifica con
    l'elenco dei giorni feriali senza ore registrate. Nessun avviso negli altri giorni.
  </p>
</template>
