<script setup>
defineProps({
  modelValue: { type: Object, required: true }, // config.reminder
  notifiche: { type: Object, required: true },  // config.notifiche
});
</script>

<template>
  <div class="form-grid">
    <div class="field field-full full" style="flex-direction:row;align-items:center;gap:8px">
      <input id="notifiche-abilitate" type="checkbox" class="checkbox-app" v-model="notifiche.abilitate">
      <label for="notifiche-abilitate" style="margin:0">Notifiche desktop abilitate</label>
    </div>
  </div>
  <p class="note-legal" style="margin-top:8px;margin-bottom:16px">
    Abilita o disabilita tutte le notifiche desktop (scadenze F24, bollo, ricevute SDI,
    promemoria, aggiornamenti regole fiscali) su macOS, Windows e Linux. Disabilitando nessuna notifica verrà mostrata.
  </p>
  <div class="form-grid">
    <div class="field field-full full" style="flex-direction:row;align-items:center;gap:8px">
      <input id="reminder-abilitato" type="checkbox" class="checkbox-app" v-model="modelValue.abilitato" :disabled="!notifiche.abilitate">
      <label for="reminder-abilitato" style="margin:0">Promemoria fine mese attivo</label>
    </div>
  </div>
  <p class="note-legal" style="margin-top:16px">
    Se attivo, solo l'ultimo giorno lavorativo del mese arriva una notifica desktop con
    l'elenco dei giorni feriali senza ore registrate. Nessun avviso negli altri giorni.
  </p>
</template>
