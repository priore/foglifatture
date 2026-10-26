<script setup>
// Sostituisce <select>: stesse <option>/<optgroup> nello slot e stesso v-model, ma la scelta
// avviene in un popup centrato (ListaPopup). Vedi .claude/rules/ui-design.md.
import { ref, useSlots, Fragment, Comment } from 'vue';
import ListaPopup from './ListaPopup.vue';
defineOptions({ inheritAttrs: false });
const props = defineProps({
  modelValue: { default: null },
  titolo: { type: String, required: true },
  descrizione: { type: String, default: '' },
  disabled: Boolean,
  required: Boolean,
});
const emit = defineEmits(['update:modelValue', 'change']);
const slots = useSlots();
const aperto = ref(false);

const testo = (c) => (typeof c === 'string' ? c : Array.isArray(c) ? c.map(testo).join('') : typeof c?.children === 'string' ? c.children : '');
function appiattisci(nodi, out = []) {
  for (const n of nodi || []) {
    if (n.type === Comment) continue;
    if (n.type === Fragment) appiattisci(n.children, out);
    else if (n.type === 'optgroup') { out.push({ gruppo: true, label: n.props?.label }); appiattisci(n.children, out); }
    else if (n.type === 'option') {
      const label = testo(n.children).trim();
      const p = n.props || {};
      out.push({ value: 'value' in p ? p.value : label, label, disabled: p.disabled !== undefined && p.disabled !== false });
    }
  }
  return out;
}
const voci = () => appiattisci(slots.default?.());
const etichetta = () => voci().find((v) => !v.gruppo && v.value === props.modelValue)?.label ?? '';
const apri = () => { if (!props.disabled) aperto.value = true; };

function conferma(valore) {
  aperto.value = false;
  emit('update:modelValue', valore);
  emit('change', valore);
}
</script>

<template>
  <span class="select-field" :class="{ disabilitato: disabled }" role="button" aria-haspopup="listbox" :tabindex="disabled ? -1 : 0" v-bind="$attrs"
    @click="apri" @keydown.enter.prevent="apri" @keydown.space.prevent="apri">
    <span class="select-field-testo">{{ etichetta() }}</span>
    <svg class="select-field-icona" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    <!-- input nascosto: mantiene la validazione nativa dei form con "required" -->
    <input class="date-field-validatore" tabindex="-1" :value="modelValue ?? ''" :required="required" @focus="apri" />
    <ListaPopup v-if="aperto" :voci="voci()" :model-value="modelValue" :titolo="titolo" :descrizione="descrizione" @conferma="conferma" @chiudi="aperto = false" />
  </span>
</template>
