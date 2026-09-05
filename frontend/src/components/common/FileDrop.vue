<script setup>
// Dropzone stilizzata, riusabile ovunque serva un input file: click per sfogliare
// o drag & drop. Emette sempre un array di File, anche per selezione singola.
import { ref } from 'vue';

const props = defineProps({
  accept: { type: String, default: '' },
  multiple: { type: Boolean, default: false },
  directory: { type: Boolean, default: false }, // webkitdirectory: intera cartella
  label: { type: String, default: 'Trascina qui i file o clicca per sfogliare' },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(['change']);

const inputEl = ref(null);
const trascinando = ref(false);

function apriSelettore() {
  if (!props.disabled) inputEl.value?.click();
}

function daInput(evento) {
  emit('change', [...evento.target.files]);
  evento.target.value = '';
}

function daDrop(evento) {
  trascinando.value = false;
  if (props.disabled) return;
  emit('change', [...evento.dataTransfer.files]);
}
</script>

<template>
  <div
    class="file-drop"
    :class="{ 'file-drop-over': trascinando, 'file-drop-disabled': disabled }"
    role="button" tabindex="0" :aria-label="label"
    @click="apriSelettore"
    @keydown.enter="apriSelettore"
    @keydown.space.prevent="apriSelettore"
    @dragover.prevent="trascinando = true"
    @dragleave.prevent="trascinando = false"
    @drop.prevent="daDrop"
  >
    <input
      ref="inputEl"
      type="file"
      :accept="accept"
      :multiple="multiple"
      :webkitdirectory="directory ? true : null"
      :disabled="disabled"
      @click.stop
      @change="daInput"
      hidden
    >
    <span class="file-drop-label">{{ label }}</span>
  </div>
</template>

<style scoped>
.file-drop {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 20px 16px;
  border: 1.5px dashed var(--line);
  border-radius: 8px;
  background: var(--ground);
  color: var(--muted);
  cursor: pointer;
  transition: border-color .15s, background .15s, color .15s;
}
.file-drop:hover {
  border-color: var(--accent);
  color: var(--ink-soft);
}
.file-drop-over {
  border-color: var(--accent);
  background: var(--ok-bg);
  color: var(--ink);
}
.file-drop-disabled {
  cursor: not-allowed;
  opacity: .6;
}
.file-drop-label {
  font-size: .9em;
}
</style>
