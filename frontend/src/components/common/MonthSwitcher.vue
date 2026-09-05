<script setup>
// Selettore mese/anno con frecce avanti/indietro, condiviso da Timesheet e Fattura
// così il mese selezionato resta coerente muovendosi tra le due schermate.
import { ref, computed } from 'vue';
const props = defineProps({
  anno: { type: Number, required: true },
  mese: { type: Number, required: true },
  // "YYYY-MM" del mese più vecchio presente in archivio: sotto questo, non si naviga.
  meseMinimo: { type: String, default: null },
});
const emit = defineEmits(['update:anno', 'update:mese']);

const NOMI_MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

// Limiti di navigazione: mai oltre dicembre dell'anno prossimo, mai sotto il primo mese in archivio.
const ORA = new Date();
const ANNO_MASSIMO = ORA.getFullYear() + 1;
const MESE_MASSIMO_CHIAVE = `${ANNO_MASSIMO}-12`;

function chiave(anno, mese) {
  return `${anno}-${String(mese).padStart(2, '0')}`;
}

function entroLimiti(anno, mese) {
  const c = chiave(anno, mese);
  if (c > MESE_MASSIMO_CHIAVE) return false;
  if (props.meseMinimo && c < props.meseMinimo) return false;
  return true;
}

const puoIndietro = computed(() => {
  const m = props.mese - 1 < 1 ? 12 : props.mese - 1;
  const a = props.mese - 1 < 1 ? props.anno - 1 : props.anno;
  return entroLimiti(a, m);
});
const puoAvanti = computed(() => {
  const m = props.mese + 1 > 12 ? 1 : props.mese + 1;
  const a = props.mese + 1 > 12 ? props.anno + 1 : props.anno;
  return entroLimiti(a, m);
});

function vai(delta) {
  let nuovoMese = props.mese + delta;
  let nuovoAnno = props.anno;
  if (nuovoMese < 1) { nuovoMese = 12; nuovoAnno -= 1; }
  if (nuovoMese > 12) { nuovoMese = 1; nuovoAnno += 1; }
  if (!entroLimiti(nuovoAnno, nuovoMese)) return;
  emit('update:mese', nuovoMese);
  emit('update:anno', nuovoAnno);
}

// Input nativo <input type="month"> nascosto, aperto al click sull'etichetta:
// permette di saltare direttamente a un mese/anno storico qualsiasi (entro i limiti).
const inputMese = ref(null);
const valoreInput = computed(() => chiave(props.anno, props.mese));

function apriSelettore() {
  inputMese.value?.showPicker ? inputMese.value.showPicker() : inputMese.value?.click();
}

function alCambio(evento) {
  const [nuovoAnno, nuovoMese] = evento.target.value.split('-').map(Number);
  if (!nuovoAnno || !nuovoMese) return;
  if (!entroLimiti(nuovoAnno, nuovoMese)) return;
  emit('update:anno', nuovoAnno);
  emit('update:mese', nuovoMese);
}
</script>

<template>
  <div class="actions">
    <button class="btn btn-ghost" :disabled="!puoIndietro" @click="vai(-1)">← {{ NOMI_MESI[(mese - 2 + 12) % 12] }}</button>
    <span
      class="btn btn-ghost" style="cursor:pointer;position:relative"
      role="button" tabindex="0" title="Vai a mese/anno..." aria-label="Vai a mese/anno..."
      @click="apriSelettore"
      @keydown.enter="apriSelettore"
      @keydown.space.prevent="apriSelettore"
    >
      {{ NOMI_MESI[mese - 1] }} {{ anno }}
      <input
        ref="inputMese" type="month" :value="valoreInput" @change="alCambio"
        :max="`${ANNO_MASSIMO}-12`" :min="meseMinimo || undefined"
        style="position:absolute;inset:0;opacity:0;cursor:pointer;border:none"
      >
    </span>
    <button class="btn btn-ghost" :disabled="!puoAvanti" @click="vai(1)">{{ NOMI_MESI[mese % 12] }} →</button>
  </div>
</template>
