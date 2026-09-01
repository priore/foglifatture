<script setup>
defineProps({
  versioneLocale: String,
  versioneRemota: String,
  changelog: String,
  inCorso: Boolean,
});
defineEmits(['aggiorna', 'annulla']);
</script>

<template>
  <div class="modal-overlay" @click.self="$emit('annulla')">
    <div class="modal-box">
      <h2>Aggiornamento disponibile</h2>
      <p class="note-legal">Versione attuale: {{ versioneLocale || '—' }} · Nuova versione: {{ versioneRemota }}</p>
      <pre v-if="changelog" class="update-changelog">{{ changelog }}</pre>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" :disabled="inCorso" @click="$emit('annulla')">Annulla</button>
        <button type="button" class="btn btn-blue" :disabled="inCorso" @click="$emit('aggiorna')">
          {{ inCorso ? 'Aggiornamento in corso…' : 'Aggiorna' }}
        </button>
      </div>
    </div>
  </div>
</template>
