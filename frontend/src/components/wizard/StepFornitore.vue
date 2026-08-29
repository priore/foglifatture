<script setup>
import { computed } from 'vue';
import LogoUpload from './LogoUpload.vue';
import { pivaValida, codiceFiscaleValido } from '../../composables/useValidazioneFiscale.js';

const props = defineProps({ modelValue: { type: Object, required: true } });

const partitaIvaOk = computed(() => pivaValida(props.modelValue.partitaIva));
const codiceFiscaleOk = computed(() => codiceFiscaleValido(props.modelValue.codiceFiscale));
</script>

<template>
  <div class="form-grid">
    <div class="field full"><LogoUpload v-model="modelValue.logoDataUrl" etichetta="Logo per la Fattura Pro-Forma (PDF)" /></div>
    <div class="field"><label>Denominazione / Nome e cognome</label><input v-model="modelValue.denominazione"></div>
    <div class="field">
      <label>Partita IVA</label>
      <input v-model="modelValue.partitaIva" :class="{ 'campo-non-valido': !partitaIvaOk }" placeholder="11 cifre">
      <small v-if="!partitaIvaOk" class="nota-errore">Deve essere di 11 cifre numeriche.</small>
    </div>
    <div class="field">
      <label>Codice Fiscale</label>
      <input v-model="modelValue.codiceFiscale" :class="{ 'campo-non-valido': !codiceFiscaleOk }" placeholder="16 caratteri, o P.IVA se società">
      <small v-if="!codiceFiscaleOk" class="nota-errore">16 caratteri (persona fisica) oppure uguale alla Partita IVA (società).</small>
    </div>
    <div class="field"><label>Regime Fiscale</label><input v-model="modelValue.regimeFiscale" disabled title="Forfettario: RF19"></div>
    <div class="field"><label>Indirizzo</label><input v-model="modelValue.indirizzo"></div>
    <div class="field"><label>Numero civico</label><input v-model="modelValue.numeroCivico"></div>
    <div class="field"><label>CAP</label><input v-model="modelValue.cap"></div>
    <div class="field"><label>Comune</label><input v-model="modelValue.comune"></div>
    <div class="field"><label>Provincia</label><input v-model="modelValue.provincia" maxlength="2" style="text-transform:uppercase"></div>
  </div>
</template>
