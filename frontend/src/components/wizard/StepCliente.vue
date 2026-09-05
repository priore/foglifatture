<script setup>
import { computed } from 'vue';
import LogoUpload from './LogoUpload.vue';
import { pivaValida, codiceSdiValido } from '../../composables/useValidazioneFiscale.js';

const props = defineProps({ modelValue: { type: Object, required: true } });

const partitaIvaOk = computed(() => pivaValida(props.modelValue.partitaIva));
const codiceSdiOk = computed(() => codiceSdiValido(props.modelValue.codiceDestinatarioSdi));
</script>

<template>
  <div class="form-grid">
    <div class="field full"><LogoUpload v-model="modelValue.logoDataUrl" etichetta="Logo per la stampa PDF del Timesheet" /></div>
    <div class="field field-full full"><label>Denominazione</label><input v-model="modelValue.denominazione"></div>
    <div class="field">
      <label>Partita IVA</label>
      <input v-model="modelValue.partitaIva" :class="{ 'campo-non-valido': !partitaIvaOk }" placeholder="11 cifre">
      <small v-if="!partitaIvaOk" class="nota-errore">Deve essere di 11 cifre numeriche.</small>
    </div>
    <div class="field">
      <label>Codice destinatario SDI</label>
      <input v-model="modelValue.codiceDestinatarioSdi" :class="{ 'campo-non-valido': !codiceSdiOk }" placeholder="7 caratteri, es. 0000000">
      <small v-if="!codiceSdiOk" class="nota-errore">Deve essere di 7 caratteri alfanumerici.</small>
    </div>
    <div class="field"><label>Indirizzo</label><input v-model="modelValue.indirizzo"></div>
    <div class="field"><label>CAP</label><input v-model="modelValue.cap"></div>
    <div class="field"><label>Comune</label><input v-model="modelValue.comune"></div>
    <div class="field"><label>Provincia</label><input v-model="modelValue.provincia" maxlength="2" style="text-transform:uppercase"></div>
    <div class="field"><label>Figura</label><input v-model="modelValue.figura"></div>
    <div class="field"><label>Commessa</label><input v-model="modelValue.commessa"></div>
    <div class="field"><label>Cliente</label><input v-model="modelValue.clientePdf"></div>
    <div class="field"><label>Progetto</label><input v-model="modelValue.progetto"></div>
  </div>
</template>
