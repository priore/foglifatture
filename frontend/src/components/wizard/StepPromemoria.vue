<script setup>
defineProps({
  modelValue: { type: Object, required: true }, // config.reminder
});
</script>

<template>
  <div class="form-grid">
    <div class="field field-full full" style="flex-direction:row;align-items:center;gap:8px">
      <input id="reminder-abilitato" type="checkbox" v-model="modelValue.abilitato" style="width:auto">
      <label for="reminder-abilitato" style="margin:0">Promemoria fine mese attivo</label>
    </div>
  </div>
  <p class="note-legal" style="margin-top:16px">
    Se attivo, solo l'ultimo giorno lavorativo del mese arriva una notifica desktop con
    l'elenco dei giorni feriali senza ore registrate. Nessun avviso negli altri giorni.
  </p>
</template>
