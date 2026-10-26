<script setup>
// Campo data: textbox con icona calendario, la selezione avviene nel popup CalendarioPopup.
// Sostituisce <input type="date"> in tutte le viste; v-model "YYYY-MM-DD".
import { ref, computed } from 'vue';
import CalendarioPopup from './CalendarioPopup.vue';
defineOptions({ inheritAttrs: false });
const props = defineProps({
  modelValue: { type: String, default: '' },
  titolo: { type: String, required: true },
  descrizione: { type: String, default: '' },
  disabled: Boolean,
  required: Boolean,
  min: { type: String, default: '' },
  max: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue', 'change']);

const aperto = ref(false);
const testo = computed(() => (props.modelValue ? props.modelValue.split('-').reverse().join('/') : ''));

function conferma(valore) {
  aperto.value = false;
  emit('update:modelValue', valore);
  emit('change', valore);
}
</script>

<template>
  <span class="date-field" :class="{ disabilitato: disabled }" role="button" :tabindex="disabled ? -1 : 0" v-bind="$attrs"
    @click="!disabled && (aperto = true)" @keydown.enter.prevent="!disabled && (aperto = true)" @keydown.space.prevent="!disabled && (aperto = true)">
    <span :class="{ 'date-field-vuoto': !testo }">{{ testo || 'gg/mm/aaaa' }}</span>
    <svg class="date-field-icona" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
    <!-- input nascosto: mantiene la validazione nativa dei form con "required" -->
    <input class="date-field-validatore" tabindex="-1" :value="modelValue" :required="required" @focus="aperto = !disabled" />
    <CalendarioPopup v-if="aperto" :model-value="modelValue" :titolo="titolo" :descrizione="descrizione" :min="min" :max="max"
      @conferma="conferma" @chiudi="aperto = false" />
  </span>
</template>
