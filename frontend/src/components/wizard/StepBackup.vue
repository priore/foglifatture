<script setup>
defineProps({
  modelValue: { type: Object, required: true }, // config.backup
});
</script>

<template>
  <div class="form-grid">
    <div class="field field-full full" style="flex-direction:row;align-items:center;gap:8px">
      <input id="backup-abilitato" type="checkbox" v-model="modelValue.abilitato" style="width:auto">
      <label for="backup-abilitato" style="margin:0">Backup automatico attivo</label>
    </div>
    <div class="field field-full full">
      <label>Cartella di destinazione</label>
      <input v-model="modelValue.percorsoDestinazione" placeholder="/Users/tuonome/Dropbox/Backup Timesheet" :disabled="!modelValue.abilitato">
    </div>
    <div class="field"><label>Ogni (minuti)</label><input type="number" min="1" v-model.number="modelValue.intervalloOreMinuti" :disabled="!modelValue.abilitato"></div>
    <div class="field"><label>Password di cifratura</label><input type="password" v-model="modelValue.password" :disabled="!modelValue.abilitato"></div>
  </div>
  <p class="note-legal" style="margin-top:16px">
    Il backup automatico viene salvato cifrato nella cartella indicata con la cadenza scelta.
    Per l'esportazione/ripristino manuale (con password inserita al momento, non salvata) vai in "Importa storico".
  </p>
</template>
