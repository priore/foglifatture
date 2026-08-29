<script setup>
defineProps({ modelValue: { type: Object, required: true } });
</script>

<template>
  <div class="form-grid">
    <div class="field"><label>Tariffa oraria (€)</label><input type="number" step="0.01" v-model.number="modelValue.tariffaOraria"></div>
    <div class="field"><label>Progressivo invio SDI</label><input type="number" step="1" min="1" v-model.number="modelValue.progressivoInvio"></div>
    <div class="field"><label>Soglia bollo virtuale (€)</label><input type="number" step="0.01" v-model.number="modelValue.sogliaBolloVirtuale"></div>
    <div class="field"><label>Importo bollo (€)</label><input type="number" step="0.01" v-model.number="modelValue.importoBollo"></div>
  </div>
</template>
