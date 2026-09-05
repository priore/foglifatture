<script setup>
defineProps({ modelValue: { type: Object, required: true } });
</script>

<template>
  <div class="form-grid">
    <div class="field"><label>Soglia bollo virtuale (€)</label><input type="number" step="0.01" v-model.number="modelValue.sogliaBolloVirtuale"></div>
    <div class="field"><label>Importo bollo (€)</label><input type="number" step="0.01" v-model.number="modelValue.importoBollo"></div>
  </div>
</template>
