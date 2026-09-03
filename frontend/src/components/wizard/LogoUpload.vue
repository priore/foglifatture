<script setup>
// Upload logo: converte l'immagine scelta in data URL e la salva direttamente
// nella configurazione (niente storage file separato, coerente con il resto
// dell'app che tiene tutto in JSON flat file).
import FileDrop from '../common/FileDrop.vue';

const props = defineProps({
  modelValue: { type: String, default: '' }, // data URL dell'immagine (o stringa vuota)
  etichetta: { type: String, default: 'Logo' },
});
const emit = defineEmits(['update:modelValue']);

const LIMITE_BYTE = 500 * 1024; // 500 KB: sufficiente per un logo, non appesantisce il config.json

function onFileSelezionato(file) {
  if (!file) return;
  if (file.size > LIMITE_BYTE) {
    alert('Immagine troppo grande: massimo 500 KB.');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => emit('update:modelValue', reader.result);
  reader.readAsDataURL(file);
}

function rimuovi() {
  emit('update:modelValue', '');
}
</script>

<template>
  <div class="field">
    <label>{{ etichetta }}</label>
    <div style="display:flex;align-items:center;gap:12px">
      <img v-if="modelValue" :src="modelValue" alt="Logo" class="logo-preview">
      <span v-else class="badge-mono">Nessun logo</span>
      <FileDrop
        accept="image/png,image/jpeg,image/svg+xml"
        label="Trascina un'immagine o clicca"
        style="flex:1"
        @change="files => onFileSelezionato(files[0])"
      />
      <button v-if="modelValue" type="button" class="btn btn-ghost" @click="rimuovi">Rimuovi</button>
    </div>
  </div>
</template>

<style scoped>
.logo-preview {
  height: 48px; max-width: 120px; object-fit: contain;
  border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 4px; background: var(--card);
}
</style>
